import {FaceLandmarker,FilesetResolver} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
const $=s=>document.querySelector(s),V=$('#v'),C=$('#c'),X=C.getContext('2d');
const NEED=20,IRIS_MM=11.7,DEG=180/Math.PI;
const MODEL=['./models/face_landmarker.task','https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'];
const POSES=[
 {t:'① 正對鏡頭，雙眼平視',ok:y=>Math.abs(y)<5},
 {t:'② 頭轉向一側約30°，眼睛仍看鏡頭',ok:y=>Math.abs(y)>22&&Math.abs(y)<38},
 {t:'③ 轉向另一側約30°',ok:(y,s)=>Math.abs(y)>22&&Math.abs(y)<38&&Math.sign(y)!==s.sign}];
let lm,st;
const dist=(q,a,b)=>Math.hypot(q[a][0]-q[b][0],q[a][1]-q[b][1],q[a][2]-q[b][2]);
const ang=(du,dv)=>Math.atan2(du>=0?dv:-dv,Math.abs(du));
const med=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
// 把臉轉回正面(依 234–454 側臉連線去除 yaw，依雙眼外角去除 roll)，原點設在鼻根 168
function norm(f){
 const W=V.videoWidth,H=V.videoHeight;
 let q=f.map(p=>[p.x*W,p.y*H,p.z*W]);const o=q[168];
 q=q.map(p=>[p[0]-o[0],p[1]-o[1],p[2]-o[2]]);
 const yaw=ang(q[454][0]-q[234][0],q[454][2]-q[234][2]);
 let c=Math.cos(yaw),s=Math.sin(yaw);
 q=q.map(([x,y,z])=>[c*x+s*z,y,-s*x+c*z]);
 const roll=ang(q[263][0]-q[33][0],q[263][1]-q[33][1]);
 c=Math.cos(roll);s=Math.sin(roll);
 q=q.map(([x,y,z])=>[c*x+s*y,-s*x+c*y,z]);
 return{q,yaw:yaw*DEG,roll:roll*DEG,pitch:ang(q[152][1]-q[10][1],q[152][2]-q[10][2])*DEG};
}
function problem(n){
 const i=st.i,w=dist(n.q,234,454)/Math.min(V.videoWidth,V.videoHeight);
 if(w<.35)return'再靠近一點';if(w>.8)return'再遠一點';
 if(Math.abs(n.roll)>5)return'頭不要歪';
 if(Math.abs(n.pitch-(i?st.pitch:0))>(i?8:15))return'不要仰頭或低頭';
 return POSES[i].ok(n.yaw,st)?null:(i?'轉到約30°並維持':'請正對鏡頭');
}
function loop(){
 if(!st.run)return;
 if(V.readyState>=2){
  const f=lm.detectForVideo(V,performance.now()).faceLandmarks[0];
  X.clearRect(0,0,C.width,C.height);let m='找不到臉，請讓整張臉入鏡';
  if(f){const n=norm(f);m=problem(n);
   for(const i of[468,473,234,454,10,152]){X.beginPath();X.arc(f[i].x*C.width,f[i].y*C.height,4,0,7);X.fillStyle='#22d3ee';X.fill()}
   if(m)st.buf=[];else{st.buf.push(n);m='保持不動…'}
  }else st.buf=[];
  $('#bar').value=st.buf.length;$('#msg').textContent=POSES[st.i].t+'｜'+m;
  if(st.buf.length>=NEED)done();
 }
 requestAnimationFrame(loop);
}
function done(){
 const b=st.buf;st.buf=[];
 const q=b[0].q.map((_,i)=>[0,1,2].map(k=>med(b.map(n=>n.q[i][k]))));
 st.views.push(q);
 if(st.i==0)st.pitch=med(b.map(n=>n.pitch));
 if(st.i==1)st.sign=Math.sign(med(b.map(n=>n.yaw)));
 navigator.vibrate?.(60);
 if(++st.i>=POSES.length){st.run=false;V.srcObject.getTracks().forEach(t=>t.stop());finish()}
}
// 融合：每個視角各自換算成 mm（以雙眼外角距離對齊正面），逐點取三視角中位數
function finish(){
 const[F,...S]=st.views,pd=+$('#pd').value;
 const sF=$('#mode').value==='pd'&&pd>0?pd/dist(F,468,473)
  :IRIS_MM/((dist(F,469,471)+dist(F,470,472)+dist(F,474,476)+dist(F,475,477))/4);
 const span=dist(F,33,263)*sF;
 const sc=[F,...S].map((q,k)=>{const s=k?span/dist(q,33,263):sF;return q.map(p=>p.map(v=>v*s))});
 st.M=F.map((_,i)=>[0,1,2].map(k=>med(sc.map(v=>v[i][k]))));
 st.spread=(a,b)=>{const v=sc.map(q=>dist(q,a,b));return Math.max(...v)-Math.min(...v)};
 show();
}
function show(){
 const M=st.M,d=(a,b)=>dist(M,a,b),dbl=+$('#dbl').value||18,f=x=>x.toFixed(1);
 const R={PD:d(468,473),外眼角距:d(33,263),內眼角距:d(133,362),右眼寬:d(33,133),左眼寬:d(263,362),臉寬:d(234,454),臉高:d(10,152)};
 R.鏡片寬建議=R.PD-dbl;R.鏡框前寬下限=R.臉寬-4;R.鏡框前寬上限=R.臉寬;st.R=R;
 const rows=[['瞳距 PD',R.PD],['外眼角距',R.外眼角距],['內眼角距（鼻樑區）',R.內眼角距],['單眼寬 右 / 左',f(R.右眼寬)+' / '+f(R.左眼寬)],
 ['臉寬（顴側 234–454）',R.臉寬],['臉高（額上緣→下巴）',R.臉高],['建議鏡片寬 A = PD − DBL',R.鏡片寬建議],['建議鏡框前寬（經驗法則）',f(R.鏡框前寬下限)+' – '+f(R.鏡框前寬上限)]];
 $('#tbl').innerHTML=rows.map(([a,b])=>`<tr><td>${a}</td><td>${typeof b=='number'?f(b):b} ${a.includes('寬 右')||a.includes('框')?'':'mm'}</td></tr>`).join('');
 $('#note').textContent=`三視角臉寬差 ${f(st.spread(234,454))} mm、PD差 ${f(st.spread(468,473))} mm（越小越可靠）。鏡腿長 V1 不量測（標準 135–150）；未做頭圍。精度未經臨床驗證，僅供參考。`;
 $('#out').hidden=false;
}
const save=(n,t)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t]));a.download=n;a.click()};
$('#ply').onclick=()=>save('head.ply',`ply\nformat ascii 1.0\nelement vertex ${st.M.length}\nproperty float x\nproperty float y\nproperty float z\nend_header\n`+st.M.map(p=>[p[0],-p[1],-p[2]].map(v=>v.toFixed(2)).join(' ')).join('\n'));
$('#json').onclick=()=>save('head.json',JSON.stringify({unit:'mm',...st.R},null,1));
$('#mode').onchange=()=>$('#pd').hidden=$('#mode').value!=='pd';
async function init(){
 const fs=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
 for(const url of MODEL)for(const delegate of['GPU','CPU']){
  try{return await FaceLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:url,delegate},runningMode:'VIDEO',numFaces:1})}catch(e){console.warn(url,delegate,e)}}
 throw new Error('模型載入失敗');
}
$('#go').onclick=async()=>{
 try{
  $('#msg').textContent='載入模型…';lm=lm||await init();
  V.srcObject=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false});
  await V.play();C.width=V.videoWidth;C.height=V.videoHeight;
  st={i:0,buf:[],views:[],run:true,pitch:0,sign:0};$('#out').hidden=true;loop();
 }catch(e){$('#msg').textContent='無法啟動：'+e.message}
};
navigator.serviceWorker?.register('sw.js');
