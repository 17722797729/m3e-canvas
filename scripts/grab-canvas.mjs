/**
 * 从正在运行的编辑器里取出当前画布，写成一份 .json
 *
 *   # 用你自己的浏览器打开编辑器，再用调试端口启动一个同源的 Chrome 窗口
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --remote-debugging-port=9222 --user-data-dir=/tmp/m3e-grab http://localhost:3000/
 *   node scripts/grab-canvas.mjs ~/Desktop/qq-farm.json
 *
 * 然后把它交给 scripts/make-template.mjs 变成内置模板。
 */
/* 从运行中的编辑器里取出当前文档，交给导入脚本当素材 */
const fs = require("node:fs");
const httpJson = (p) => new Promise((res, rej) => { require("node:http").get({host:"127.0.0.1",port:9222,path:p}, r => { let b=""; r.on("data",c=>b+=c); r.on("end",()=>res(JSON.parse(b))); }).on("error",rej); });
class Cdp {
  constructor(ws){this.ws=ws;this.id=0;this.p=new Map();ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id&&this.p.has(m.id)){const{resolve,reject}=this.p.get(m.id);this.p.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);}});}
  send(method,params={}){const id=++this.id;this.ws.send(JSON.stringify({id,method,params}));return new Promise((resolve,reject)=>this.p.set(id,{resolve,reject}));}
  async eval(e){const r=await this.send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;}
}
(async()=>{
  const tabs = await httpJson("/json/list");
  const page = tabs.find(t=>t.type==="page" && !t.url.startsWith("devtools"));
  const open = tabs.filter(t=>t.type==="page").map(t=>t.url);
  if (!page) { console.error("没有可用的标签页。当前：", open.join(" | ")); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener("open",r));
  const cdp = new Cdp(ws);
  await cdp.send("Runtime.enable");
  const doc = await cdp.eval(`localStorage.getItem('m3e:doc')`);
  if (!doc) { console.error("这个标签页里没有存过文档"); process.exit(1); }
  const parsed = JSON.parse(doc);
  fs.writeFileSync(process.argv[2] || "/tmp/current-canvas.json", doc);
  console.log(`已导出 ${parsed.frames?.length ?? 0} 屏、${parsed.groups?.length ?? 0} 组 → ${process.argv[2] || "/tmp/current-canvas.json"}`);
  console.log("屏幕名:", (parsed.frames ?? []).map(f => f.name).join(" · "));
  process.exit(0);
})().catch(e=>{console.error("FAILED",e.message);process.exit(1);});
