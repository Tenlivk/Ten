/*
东东健康社区 兑换商品
更新时间：2021-7-14
0 0 * * * * jd_health_exchange.js
 */
const $ = new Env("东东健康兑换商品");
const jdCookieNode = $.isNode() ? require("./jdCookie.js") : "";
const notify = $.isNode() ? require('./sendNotify') : '';

let cookiesArr = [],TaskList = [],
	cookie = "",
	message = '';

let maxThread=4; //并发数
let healthExchangeName = '20';//要兑换的商品名称,默认兑换20京豆;
healthExChangeName = $.isNode() ? (process.env.HEALTH_EXCHANGE_NAME ? process.env.HEALTH_EXCHANGE_NAME : healthExchangeName) : ($.getdata('healthExchangeName') ? $.getdata('healthExchangeName') : healthExchangeName);
if ($.isNode()) {
	Object.keys(jdCookieNode).forEach((item) => {
		cookiesArr.push(jdCookieNode[item]);
	});
	if (process.env.JD_DEBUG && process.env.JD_DEBUG === "false") console.log = () => {};
} else {
	cookiesArr = [
		$.getdata("CookieJD"),
		$.getdata("CookieJD2"),
		...$.toObj($.getdata("CookiesJD") || "[]").map((item) => item.cookie),
	].filter((item) => !!item);
}
const JD_API_HOST = "https://api.m.jd.com/";
!(async() => {
    if (!cookiesArr[0]) {
        $.msg(
            $.name,
            "【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取",
            "https://bean.m.jd.com/", {
            "open-url": "https://bean.m.jd.com/"
        });
        return;
    }
    for (let i = cookiesArr.length-1; i >-1 && !$.jBeans && !$.physicals; i--) {
        if (cookiesArr[i]) {
            cookie = cookiesArr[i];
            console.log(`已使用 账号 ${i + 1}查到 奖品数据列表\n`);
            $.waitIndex = i;
            await jdhealth_getCommodities(cookie);
        }
    }
	await $.wait(1000);
	
    for (let i = 0; i < cookiesArr.length; i++) {
        if (cookiesArr[i]) {
			cookie = cookiesArr[i];
            TaskList.push(main(cookie))
            if ($.index == cookiesArr.length || TaskList.length== maxThread) {
                await Promise.all(TaskList);
				TaskList=[];
            }
        }
    }
    if (message) {
        $.msg($.name, '', message);
        await notify.sendNotify($.name, message);
    }
})()
.catch((e) => {
    $.log("", `❌ ${$.name}, 失败! 原因: ${e}!`, "");
})
.finally(() => {
    $.done();
});
async function main(strcookie) {
  try {
	 if (!strcookie)
		 return
	var strUserName = decodeURIComponent(strcookie.match(/pt_pin=([^; ]+)(?=;?)/) && strcookie.match(/pt_pin=([^; ]+)(?=;?)/)[1]);
    if (healthExchangeName === '20') {
      //兑换京豆
      if ($.jBeans && $.jBeans.length) {
        const bean20 = $.jBeans.filter(vo => vo['type'] === 2 && vo['id'] === '4' && vo['title'] === '20');
        if (bean20 && bean20.length) {
          $.title = bean20[0]['title'];
          const body = {
            commodityType: bean20[0]['type'],
            commodityId: bean20[0]['id'],
          }
          //console.log(strUserName+`开始兑换商品：【${$.title}】京豆`);
          if (body['commodityType'] && body['commodityId']) await jdhealth_exchange(strcookie,body);
        } else {
          console.log(strUserName+`兑换20京豆商品不存在, ${$.toStr($.jBeans)}\n`);
        }
      }
    } else {
      //兑换商品
      if ($.physicals && $.physicals.length) {
        for (let index = 0; index < $.physicals.length; index ++) {
          if ($.physicals[index]['title'].indexOf(healthExchangeName) > -1) {
            $.id = $.physicals[index].id;
            $.title = $.physicals[index].title;
            $.type = $.physicals[index].type;
            $.status = $.physicals[index].status;
          }
        }
        if ($.id && $.type) {
          console.log(`开始兑换商品：【${$.title}】`);
          const body = {
            commodityType: $.type,
            commodityId: $.id,
          }
          await jdhealth_exchange(strcookie,body);
        }
      }
    }
  } catch (e) {
    $.logErr(e)
  }
}
function jdhealth_getCommodities(strcookie) {
	return new Promise((resolve) => {
		$.post(taskUrl("jdhealth_getCommodities",strcookie, {}), async (err, resp, data) => {
			try {
			  if (err) {
          $.logErr(err);
        } else {
          data = $.toObj(data);
          if (data['code'] === 0) {
            if (data.data.bizCode === 0) {
              $.jBeans = data.data.result.jBeans;
              $.physicals = data.data.result.physicals;
              let msg = ``;
              if ($.physicals && Array.isArray($.physicals) && $.physicals.length) {
                for (let physical of $.physicals) {
                  msg += `${physical['title']} | 需健康值：${(physical['exchangePoints'] / 10000).toFixed(1)}万 | ${physical['status'] === 0 ? '库存充足' : '库存不足'}\n`;
                }
                if (msg) {
                  msg += `前往兑换：https://h5.m.jd.com/babelDiy/Zeus/D2CwCLVmaP3QonubWFJeTVhYRyT/index.html`;
                  $.msg('东东健康一元兑换专区', '', msg);
                  //if ($.isNode()) await notify.sendNotify('东东健康一元兑换专区', msg);
                }
              }
            } else {
              console.log(`jdhealth_getCommodities 失败：${JSON.stringify(data)}`);
            }
          } else {
            console.log('jdhealth_getCommodities 异常：' + data['msg'])
          }
        }
			} catch (e) {
				console.log(e);
			} finally {
				resolve();
			}
		});
	});
}
function jdhealth_exchange(strcookie,body, timeout = $.waitIndex === ($.index - 1) ? 900 : 0) {
  return new Promise((resolve) => {
    setTimeout(() => {
	  var strUserName = decodeURIComponent(strcookie.match(/pt_pin=([^; ]+)(?=;?)/) && strcookie.match(/pt_pin=([^; ]+)(?=;?)/)[1]);
      const options = taskUrl("jdhealth_exchange",strcookie, body);
      $.post(options, (err, resp, data) => {
        try {
          if (err) {
            $.logErr(err);
          } else {
            data = $.toObj(data);
            if (data && data['code'] === 0) {
              if (data.data.bizCode === 0) {
                if (data['data']['result']['commodityType'] === 2 && data['data']['result']['jingBeanNum']) {
                  console.log(`${data['data']['result']['jingBeanNum']}京豆兑换成功🎉\n`);
                  message += `京东账号 ${strUserName}:${data['data']['result']['jingBeanNum']}京豆兑换成功🎉 ${$.index === cookiesArr.length ? '' : '\n\n'}`;
                }
                if (data['data']['result']['commodityType'] === 1) {
                  console.log(`${$.title} 兑换成功🎉\n`);
                  message += `京东账号 ${strUserName}:${$.title}兑换成功🎉 ${$.index === cookiesArr.length ? '' : '\n\n'}`;
                }
              } else {
                console.log(`京东账号 ${strUserName}:兑换【${$.title}】失败：${data['data']['bizMsg']}`);
              }
            } else {
              console.log(data['msg'])
            }
          }
        } catch (e) {
          console.log(e);
        } finally {
          resolve();
        }
      });
    }, timeout)
  });
}
function taskUrl(function_id,strcookie, body = {}) {
	return {
		url: `${JD_API_HOST}`,
    body: `functionId=${function_id}&body=${(JSON.stringify(body))}&client=wh5&clientVersion=1.0.0&uuid=`,
    // body: `functionId=jdhealth_exchange&body={"commodityType":2,"commodityId":"4"}&client=wh5&clientVersion=1.0.0&uuid=`,
    headers: {
      "Host": "api.m.jd.com",
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": "https://h5.m.jd.com",
      "Accept-Encoding": "gzip, deflate, br",
      "Cookie": strcookie,
      "Connection": "keep-alive",
      "Accept": "application/json, text/plain, */*",
      "User-Agent": $.isNode()
      ? process.env.JD_USER_AGENT
          ? process.env.JD_USER_AGENT
          : require("./USER_AGENTS").USER_AGENT
      : $.getdata("JDUA")
          ? $.getdata("JDUA")
          : "jdapp;iPhone;9.4.4;14.3;network/4g;Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1",
      "Referer": "https://h5.m.jd.com/babelDiy/Zeus/D2CwCLVmaP3QonubWFJeTVhYRyT/index.html",
      "Accept-Language": "zh-cn"
    }
	};
}

// prettier-ignore
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),n={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
