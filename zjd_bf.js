/*
赚京豆-并发
@Leaf
0 0 * * * * zjd_bf.js
*/
const $ = new Env("赚京豆");

let NUM_MAX_RETRY = 2 //开团火爆重试次数，调成0也可以
let NUM_CONCURRENCY = 10 //并发数

let envSplitor = ['&','\n']
let httpResult, httpReq, httpResp

const jsdom = require('jsdom');
const datefns = require('date-fns');
const CryptoJS = require('crypto-js')

let userCookie = ($.isNode() ? process.env.JD_COOKIE : $.getdata('JD_COOKIE')) || '';

let userList = []
let validJdList = []
let userIdx = 0
let userCount = 0

let h5stMode = 1
let signWaap = null
let fingerprint, enCryptMethodJD, h5stToken

let zjdAppid = "b342e"
let h5stAppid = "swat_miniprogram"
let h5stVersion = '3.0'
let defaultUA = 'Mozilla/5.0 (Linux; Android 9; Note9 Build/PKQ1.181203.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.99 XWEB/3211 MMWEBSDK/20220303 Mobile Safari/537.36 MMWEBID/8813 MicroMessenger/8.0.21.2120(0x2800153B) Process/appbrand1 WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64 MiniProgramEnv/android'
let Referer = 'https://servicewechat.com/wxa5bf5ee667d91626/190/page-frame.html'

let iosVerList = ["15.1.1", "14.5.1", "14.4", "14.3", "14.2", "14.1", "14.0.1"]
let clientVerList = ["10.3.0", "10.2.7", "10.2.4"]
let iphoneVerList = ["8","9","10","11","12","13"]
///////////////////////////////////////////////////////////////////
class UserInfo {
    constructor(str) {
        this.index = ++userIdx
        this.name = this.index
        this.isJdCK = false
        this.valid = false
        
        try {
            this.cookie = str
            this.pt_key = str.match(/pt_key=([\w\-]+)/)[1]
            this.pt_pin = decodeURIComponent(str.match(/pt_pin=([\w\-\%]+)/)[1])
            this.isJdCK = true
            this.uuid = $.randomString(40)
            this.addressid = $.randomString(10,'123456789')
            this.iosVer = $.randomList(iosVerList)
            this.iosVer_ = this.iosVer.replace('.', '_')
            this.iphone = $.randomList(iphoneVerList)
            this.sid = $.randomString(32)
            this.un_area = $.randomString(2,'1234567890') + '-' + $.randomString(4,'1234567890') + '-' + $.randomString(4,'1234567890') + '-' + $.randomString(5,'1234567890')
            this.UA = `jdapp;iPhone;10.1.4;${this.iosVer};${this.uuid};network/wifi;model/iPhone${this.iphone},1;addressid/${this.addressid};appBuild/167707;jdSupportDarkMode/0;Mozilla/5.0 (iPhone; CPU iPhone OS ${this.iosVer_} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/null;supportJDSHWK/1`
            
            this.result = ''
            this.needHelp = false
            this.maxHelp = false
            this.canHelp = true
        } catch (e) {
            console.log(`账号[${this.index}]CK无效，可能不是京东CK`)
        }
    }
    
    async jdApi(functionID,bodyInfo,appId) {
        this.result = ''
        try {
            let url = `https://api.m.jd.com/api?functionId=${functionID}&fromType=wxapp&timestamp=${Date.now()}`
            let param = {
                "appid": h5stAppid,
                "body": CryptoJS.SHA256(JSON.stringify(bodyInfo)).toString(CryptoJS.enc.Hex),
                "functionId": functionID,
            }
            let body = ''
            if(h5stMode == 0) {
                let h5st = get_h5st(param);
                body = `functionId=distributeBeanActivityInfo&body=${encodeURIComponent(JSON.stringify(bodyInfo))}&appid=swat_miniprogram&h5st=${encodeURIComponent(h5st)}`
            } else if(h5stMode == 1) {
                let h5st = await signWaap(appId, { appid: "swat_miniprogram", body: bodyInfo, clientVersion: "3.1.3", client: "tjj_m", functionId: functionID });
                body = `body=${encodeURIComponent(JSON.stringify(bodyInfo))}&appid=swat_miniprogram&h5st=${encodeURIComponent(h5st)}&uuid=${this.uuid}&client=tjj_m&screen=1920*1080&osVersion=5.0.0&networkType=wifi&sdkName=orderDetail&sdkVersion=1.0.0&clientVersion=3.1.3&area=11`
            } else {
                console.log(`不支持的h5stMode: ${h5stMode}`)
            }
            let cookie = `${this.cookie}appid=wxa5bf5ee667d91626;wxclient=gxhwx;ie_ai=1;appkey=797c7d5f8f0f499b936aad5edcffa08c`
            let urlObject = populateUrlObject(url,cookie,defaultUA,body)
            await httpRequest('post',urlObject)
            this.result = httpResult;
        } catch(e) {
            console.log(e)
        } finally {
            return new Promise((resolve) => {resolve(1)});
        }
    }
    
    async getUserTuanInfo(retry=0) {
        try {
            await this.jdApi('distributeBeanActivityInfo', { "paramData": { "channel": "FISSION_BEAN" }}, 'd8ac0');
            //console.log(JSON.stringify(this.result))
            if(this.result?.success == true && this.result?.data) {
                let data = this.result.data
                if(data.canStartNewAssist) {
                    console.log(`账号${this.index}[${this.pt_pin}]可以开团`)
                    await this.startNewAssist(data.id)
                } else {
                    if(data.assistStatus == 1) {
                        this.needHelp = true
                        this.assistParam = {
                            "activityIdEncrypted": data.id,
                            "assistStartRecordId": data.assistStartRecordId,
                            "assistedPinEncrypted": data.encPin,
                            "channel": "FISSION_BEAN",
                            "launchChannel": "undefined"
                        }
                        console.log(`账号${this.index}[${this.pt_pin}]已开团，获取到助力参数`)
                    } else if(data.assistStatus == 2) {
                        console.log(`账号${this.index}[${this.pt_pin}]开团已过期，助力未满`)
                        this.needHelp = false
                        this.maxHelp = true
                    } else if(data.assistStatus == 3) {
                        console.log(`账号${this.index}[${this.pt_pin}]开团上限且助力已满`)
                        this.needHelp = false
                        this.maxHelp = true
                    } else {
                        console.log(`账号${this.index}[${this.pt_pin}]: canStartNewAssist=${data.canStartNewAssist}, assistStatus=${data.assistStatus}`)
                    }
                }
            } else {
                console.log(`账号${this.index}[${this.pt_pin}]获取开团信息失败: ${this.result?.message}`)
                if(this.result?.message && this.result.message.indexOf('火爆') > -1) {
                    if(retry < NUM_MAX_RETRY) {
                        retry++
                        console.log(`账号${this.index}[${this.pt_pin}]获取开团信息重试第${retry}次`)
                        await this.getUserTuanInfo(retry)
                    } else {
                        this.maxHelp = true
                    }
                }
            }
        } catch(e) {
            console.log(e)
        } finally {
            return new Promise((resolve) => {resolve(1)});
        }
    }
    
    async startNewAssist(id) {
        try {
            await this.jdApi('vvipclub_distributeBean_startAssist', { "activityIdEncrypted": id, "channel": "FISSION_BEAN", "launchChannel": "undefined" }, 'dde2b');
            //console.log(JSON.stringify(this.result))
            if(this.result?.success == true) {
                console.log(`账号${this.index}[${this.pt_pin}]开团成功`)
                await this.getUserTuanInfo();
            } else {
                console.log(`账号${this.index}[${this.pt_pin}]开团失败: ${this.result?.message}`)
            }
        } catch(e) {
            console.log(e)
        } finally {
            return new Promise((resolve) => {resolve(1)});
        }
    }
    
    async help(helpee) {
        try {
            await this.jdApi('vvipclub_distributeBean_assist', helpee.assistParam, 'b9790');
            //console.log(JSON.stringify(this.result))
            if(this.result?.success == true) {
                console.log(`助力账号${helpee.index}[${helpee.pt_pin}]成功`)
            } else {
                if(this.result) {
                    let data = this.result
                    if (data.resultCode === '9200008') {
                        console.log(`助力 账号${helpee.index}[${helpee.pt_pin}]失败：不能助力自己`)
                    } else if (data.resultCode === '9200011') {
                        console.log(`助力 账号${helpee.index}[${helpee.pt_pin}]失败：已经助力过`)
                    } else if (data.resultCode === '2400205') {
                        console.log(`助力账号${helpee.index}[${helpee.pt_pin}]失败：对方团已满`)
                        helpee.needHelp = false
                        await helpee.getUserTuanInfo();
                        if(helpee.needHelp) await this.help(helpee)
                    } else if (data.resultCode === '2400203' || data.resultCode === '90000014' ) {
                        console.log(`助力账号${helpee.index}[${helpee.pt_pin}]失败：助力次数已耗尽`);
                        this.canHelp = false
                    } else if (data.resultCode === '9000000' || data.resultCode === '9000013'|| data.resultCode === '101' || data.resultCode === '1000022') {
                        console.log(`助力账号${helpee.index}[${helpee.pt_pin}]失败：[${data.resultCode}]活动火爆`);
                        this.canHelp = false
                    } else {
                        console.log(`助力账号${helpee.index}[${helpee.pt_pin}]失败: [${data?.resultCode}]${data?.message}`)
                        this.canHelp = false
                    }
                } else {
                    console.log(httpResp)
                }
            }
        } catch(e) {
            console.log(e)
        } finally {
            return new Promise((resolve) => {resolve(1)});
        }
    }
    
    async userHelpTask(helpee) {
        try {
            if(!helpee.needHelp && !helpee.maxHelp) {
                await helpee.getUserTuanInfo()
            }
            if(helpee.needHelp) {
                await this.help(helpee)
            }
        } catch(e) {
            console.log(e)
        } finally {
            return new Promise((resolve) => {resolve(1)});
        }
    }
    
    async userTask() {
        try {
            console.log(`\n=================== 账号[${this.index}]开始助力 ===================`)
            let taskall = []
            for(let helpee of validJdList.filter(x => x.index != this.index && !x.maxHelp)) {
                taskall.push(this.userHelpTask(helpee))
                if(taskall.length >= NUM_CONCURRENCY) {
                    await Promise.all(taskall)
                    taskall = []
                }
                if(!this.canHelp) break;
            }
            if(taskall.length > 0) await Promise.all(taskall)
        } catch(e) {
            console.log(e)
        } finally {
            return new Promise((resolve) => {resolve(1)});
        }
    }
}

!(async () => {
    if (typeof $request !== "undefined") {
        await GetRewrite()
    }else {
        if(!(await checkEnv())) return;
        
        if(h5stMode == 0) {
            await requestAlgo();
        } else if(h5stMode == 1) {
            await jstoken();
        } else {
            console.log(`不支持的h5stMode: ${h5stMode}`)
        }
        
        validJdList = userList.filter(x => x.isJdCK)
        if(validJdList.length == 0) return;
        
        for(let user of validJdList) {
            await user.userTask();
        }
    }
})()
.catch((e) => console.log(e))
.finally(() => $.done())

async function jstoken() {
    const { JSDOM } = jsdom;
    let resourceLoader = new jsdom.ResourceLoader({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:91.0) Gecko/20100101 Firefox/91.0',
        referrer: "https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu"
    });
    let virtualConsole = new jsdom.VirtualConsole();
    let options = {
        url: "https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu",
        referrer: "https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu",
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:91.0) Gecko/20100101 Firefox/91.0',
        runScripts: "dangerously",
        resources: resourceLoader,
        includeNodeLocations: true,
        storageQuota: 10000000,
        pretendToBeVisual: true,
        virtualConsole
    };
    const dom = new JSDOM(`<body>
    <script src="https:////static.360buyimg.com/siteppStatic/script/mescroll/map.js"></script>
    <script src="https://storage.360buyimg.com/webcontainer/js_security_v3.js"></script>
    <script src="https://static.360buyimg.com/siteppStatic/script/utils.js"></script>
    <script src="https://js-nocaptcha.jd.com/statics/js/main.min.js"></script>
    </body>`, options);
    await $.wait(1500)
    try {
        jab = new dom.window.JAB({
            bizId: 'jdjiabao',
            initCaptcha: false
        });
        signWaap = dom.window.signWaap;
    } catch (e) {}
}
async function requestAlgo() {
    try {
        fingerprint = '5751706390487846'
        let bodyParam = {
            "version": h5stVersion,
            "fp": fingerprint,
            "appId": zjdAppid,
            "timestamp": Date.now(),
            "platform": "web",
            "expandParams": ""
        }
        let urlObject = {
            url: 'https://cactus.jd.com/request_algo?g_ty=ajax',
            headers: {
                'Content-Type': 'application/json',
                'Host': 'cactus.jd.com',
                'Referer': 'https://cactus.jd.com',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E217 MicroMessenger/6.8.0(0x16080000) NetType/WIFI Language/en Branch/Br_trunk MiniProgramEnv/Mac'
            },
            timeout: 5000,
            body: JSON.stringify(bodyParam)
        }
        await httpRequest('post',urlObject)
        let result = httpResult
        if (result.status === 200) {
            h5stToken = result.data.result.tk;
            let enCryptMethodJDString = result.data.result.algo;
            if (enCryptMethodJDString) {
                enCryptMethodJD = new Function(`return ${enCryptMethodJDString}`)();
            }
        } else {
            console.log(`fp: ${fingerprint}`)
            console.log('request_algo 签名参数API请求失败')
        }
    } catch(e) {
        console.log(e)
    } finally {
        return new Promise((resolve) => {resolve(1)});
    }
}

function get_h5st(param) {
    let nowtime = new Date()
    let datetime = datefns.format(nowtime, 'yyyyMMddhhmmssSSS')
    let timestamp = nowtime.getTime()
    let hash1;
    if (fingerprint && h5stToken && enCryptMethodJD) {
        hash1 = enCryptMethodJD(h5stToken, fingerprint.toString(), datetime.toString(), zjdAppid.toString(), CryptoJS).toString(CryptoJS.enc.Hex);
    } else {
        let random = '5gkjB6SpmC9s';
        h5stToken = `tk01wcdf61cb3a8nYUtHcmhSUFFCfddDPRvKvYaMjHkxo6Aj7dhzO+GXGFa9nPXfcgT+mULoF1b1YIS1ghvSlbwhE0Xc`;
        fingerprint = 9686767825751161;
        // $.fingerprint = 7811850938414161;
        let str = `${h5stToken}${fingerprint}${datetime}${zjdAppid}${random}`;
        hash1 = CryptoJS.SHA512(str, h5stToken).toString(CryptoJS.enc.Hex);
    }
    let st = []
    for(let key in param) {
        st.push(`${key}:${param[key]}`)
    }
    let hash2 = CryptoJS.HmacSHA256(st.join('&'), hash1.toString()).toString(CryptoJS.enc.Hex);
    let h5stParams = [
        datetime,
        fingerprint,
        zjdAppid,
        h5stToken,
        hash2,
        h5stVersion,
        timestamp,
    ]
    return h5stParams.join(';')
}

function generateFp() {
    let e = "0123456789";
    let a = 13;
    let i = '';
    for (; a--; )
        i += e[Math.random() * e.length | 0];
    return (i + Date.now()).slice(0, 16)
}
///////////////////////////////////////////////////////////////////
async function checkEnv() {
    if(userCookie) {
        let splitor = envSplitor[0];
        for(let sp of envSplitor) {
            if(userCookie.indexOf(sp) > -1) {
                splitor = sp;
                break;
            }
        }
        for(let userCookies of userCookie.split(splitor)) {
            if(userCookies) userList.push(new UserInfo(userCookies))
        }
        userCount = userList.length
    } else {
        console.log('未找到CK')
        return;
    }
    
    console.log(`共找到${userCount}个账号`)
    return true
}

////////////////////////////////////////////////////////////////////
function populateUrlObject(url,cookie,UA,body=''){
    let host = url.replace('//','/').split('/')[1]
    let urlObject = {
        url: url,
        headers: {
            'Host': host,
            'Cookie': cookie,
            'Referer': Referer,
            'User-Agent': UA,
        },
        timeout: 5000,
    }
    if(body) {
        urlObject.body = body
        urlObject.headers['Content-Type'] =  'application/x-www-form-urlencoded'
        urlObject.headers['Content-Length'] = urlObject.body ? urlObject.body.length : 0
    }
    return urlObject;
}

async function httpRequest(method,url) {
    httpResult = null, httpReq = null, httpResp = null;
    return new Promise((resolve) => {
        $.send(method, url, async (err, req, resp) => {
            try {
                httpReq = req;
                httpResp = resp;
                if (err) {
                    console.log(err)
                    //console.log(req)
                    //console.log(resp)
                } else {
                    if(resp.body) {
                        if(typeof resp.body == "object") {
                            httpResult = resp.body;
                        } else {
                            try {
                                httpResult = JSON.parse(resp.body);
                            } catch (e) {
                                httpResult = resp.body;
                            }
                        }
                    }
                }
            } catch (e) {
                //console.log(e);
            } finally {
                resolve();
            }
        });
    });
}

////////////////////////////////////////////////////////////////////
//AES/DES加解密，CryptoJS
function EncryptCrypto(method,mode,padding,message,key,iv) {
    return CryptoJS[method].encrypt(
        CryptoJS.enc.Utf8.parse(message), 
        CryptoJS.enc.Utf8.parse(key), 
        {mode:CryptoJS.mode[mode], padding:CryptoJS.pad[padding], iv:CryptoJS.enc.Utf8.parse(iv)}
    ).ciphertext.toString(CryptoJS.enc.Base64);
}
function DecryptCrypto(method,mode,padding,message,key,iv) {
    return CryptoJS[method].decrypt(
        {ciphertext: CryptoJS.enc.Base64.parse(message)}, 
        CryptoJS.enc.Utf8.parse(key), 
        {mode:CryptoJS.mode[mode], padding:CryptoJS.pad[padding], iv:CryptoJS.enc.Utf8.parse(iv)}
    ).toString(CryptoJS.enc.Utf8);
}
//Base64加解密
var Base64={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/[^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/rn/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}}
//MD5
function MD5Encrypt(a){function b(a,b){return a<<b|a>>>32-b}function c(a,b){var c,d,e,f,g;return e=2147483648&a,f=2147483648&b,c=1073741824&a,d=1073741824&b,g=(1073741823&a)+(1073741823&b),c&d?2147483648^g^e^f:c|d?1073741824&g?3221225472^g^e^f:1073741824^g^e^f:g^e^f}function d(a,b,c){return a&b|~a&c}function e(a,b,c){return a&c|b&~c}function f(a,b,c){return a^b^c}function g(a,b,c){return b^(a|~c)}function h(a,e,f,g,h,i,j){return a=c(a,c(c(d(e,f,g),h),j)),c(b(a,i),e)}function i(a,d,f,g,h,i,j){return a=c(a,c(c(e(d,f,g),h),j)),c(b(a,i),d)}function j(a,d,e,g,h,i,j){return a=c(a,c(c(f(d,e,g),h),j)),c(b(a,i),d)}function k(a,d,e,f,h,i,j){return a=c(a,c(c(g(d,e,f),h),j)),c(b(a,i),d)}function l(a){for(var b,c=a.length,d=c+8,e=(d-d%64)/64,f=16*(e+1),g=new Array(f-1),h=0,i=0;c>i;)b=(i-i%4)/4,h=i%4*8,g[b]=g[b]|a.charCodeAt(i)<<h,i++;return b=(i-i%4)/4,h=i%4*8,g[b]=g[b]|128<<h,g[f-2]=c<<3,g[f-1]=c>>>29,g}function m(a){var b,c,d="",e="";for(c=0;3>=c;c++)b=a>>>8*c&255,e="0"+b.toString(16),d+=e.substr(e.length-2,2);return d}function n(a){a=a.replace(/\r\n/g,"\n");for(var b="",c=0;c<a.length;c++){var d=a.charCodeAt(c);128>d?b+=String.fromCharCode(d):d>127&&2048>d?(b+=String.fromCharCode(d>>6|192),b+=String.fromCharCode(63&d|128)):(b+=String.fromCharCode(d>>12|224),b+=String.fromCharCode(d>>6&63|128),b+=String.fromCharCode(63&d|128))}return b}var o,p,q,r,s,t,u,v,w,x=[],y=7,z=12,A=17,B=22,C=5,D=9,E=14,F=20,G=4,H=11,I=16,J=23,K=6,L=10,M=15,N=21;for(a=n(a),x=l(a),t=1732584193,u=4023233417,v=2562383102,w=271733878,o=0;o<x.length;o+=16)p=t,q=u,r=v,s=w,t=h(t,u,v,w,x[o+0],y,3614090360),w=h(w,t,u,v,x[o+1],z,3905402710),v=h(v,w,t,u,x[o+2],A,606105819),u=h(u,v,w,t,x[o+3],B,3250441966),t=h(t,u,v,w,x[o+4],y,4118548399),w=h(w,t,u,v,x[o+5],z,1200080426),v=h(v,w,t,u,x[o+6],A,2821735955),u=h(u,v,w,t,x[o+7],B,4249261313),t=h(t,u,v,w,x[o+8],y,1770035416),w=h(w,t,u,v,x[o+9],z,2336552879),v=h(v,w,t,u,x[o+10],A,4294925233),u=h(u,v,w,t,x[o+11],B,2304563134),t=h(t,u,v,w,x[o+12],y,1804603682),w=h(w,t,u,v,x[o+13],z,4254626195),v=h(v,w,t,u,x[o+14],A,2792965006),u=h(u,v,w,t,x[o+15],B,1236535329),t=i(t,u,v,w,x[o+1],C,4129170786),w=i(w,t,u,v,x[o+6],D,3225465664),v=i(v,w,t,u,x[o+11],E,643717713),u=i(u,v,w,t,x[o+0],F,3921069994),t=i(t,u,v,w,x[o+5],C,3593408605),w=i(w,t,u,v,x[o+10],D,38016083),v=i(v,w,t,u,x[o+15],E,3634488961),u=i(u,v,w,t,x[o+4],F,3889429448),t=i(t,u,v,w,x[o+9],C,568446438),w=i(w,t,u,v,x[o+14],D,3275163606),v=i(v,w,t,u,x[o+3],E,4107603335),u=i(u,v,w,t,x[o+8],F,1163531501),t=i(t,u,v,w,x[o+13],C,2850285829),w=i(w,t,u,v,x[o+2],D,4243563512),v=i(v,w,t,u,x[o+7],E,1735328473),u=i(u,v,w,t,x[o+12],F,2368359562),t=j(t,u,v,w,x[o+5],G,4294588738),w=j(w,t,u,v,x[o+8],H,2272392833),v=j(v,w,t,u,x[o+11],I,1839030562),u=j(u,v,w,t,x[o+14],J,4259657740),t=j(t,u,v,w,x[o+1],G,2763975236),w=j(w,t,u,v,x[o+4],H,1272893353),v=j(v,w,t,u,x[o+7],I,4139469664),u=j(u,v,w,t,x[o+10],J,3200236656),t=j(t,u,v,w,x[o+13],G,681279174),w=j(w,t,u,v,x[o+0],H,3936430074),v=j(v,w,t,u,x[o+3],I,3572445317),u=j(u,v,w,t,x[o+6],J,76029189),t=j(t,u,v,w,x[o+9],G,3654602809),w=j(w,t,u,v,x[o+12],H,3873151461),v=j(v,w,t,u,x[o+15],I,530742520),u=j(u,v,w,t,x[o+2],J,3299628645),t=k(t,u,v,w,x[o+0],K,4096336452),w=k(w,t,u,v,x[o+7],L,1126891415),v=k(v,w,t,u,x[o+14],M,2878612391),u=k(u,v,w,t,x[o+5],N,4237533241),t=k(t,u,v,w,x[o+12],K,1700485571),w=k(w,t,u,v,x[o+3],L,2399980690),v=k(v,w,t,u,x[o+10],M,4293915773),u=k(u,v,w,t,x[o+1],N,2240044497),t=k(t,u,v,w,x[o+8],K,1873313359),w=k(w,t,u,v,x[o+15],L,4264355552),v=k(v,w,t,u,x[o+6],M,2734768916),u=k(u,v,w,t,x[o+13],N,1309151649),t=k(t,u,v,w,x[o+4],K,4149444226),w=k(w,t,u,v,x[o+11],L,3174756917),v=k(v,w,t,u,x[o+2],M,718787259),u=k(u,v,w,t,x[o+9],N,3951481745),t=c(t,p),u=c(u,q),v=c(v,r),w=c(w,s);var O=m(t)+m(u)+m(v)+m(w);return O.toLowerCase()}
//SHA1
function SHA1Encrypt(msg){function add(x,y){return((x&0x7FFFFFFF)+(y&0x7FFFFFFF))^(x&0x80000000)^(y&0x80000000);}function SHA1hex(num){var sHEXChars="0123456789abcdef";var str="";for(var j=7;j>=0;j--)str+=sHEXChars.charAt((num>>(j*4))&0x0F);return str;}function AlignSHA1(sIn){var nblk=((sIn.length+8)>>6)+1,blks=new Array(nblk*16);for(var i=0;i<nblk*16;i++)blks[i]=0;for(i=0;i<sIn.length;i++)blks[i>>2]|=sIn.charCodeAt(i)<<(24-(i&3)*8);blks[i>>2]|=0x80<<(24-(i&3)*8);blks[nblk*16-1]=sIn.length*8;return blks;}function rol(num,cnt){return(num<<cnt)|(num>>>(32-cnt));}function ft(t,b,c,d){if(t<20)return(b&c)|((~b)&d);if(t<40)return b^c^d;if(t<60)return(b&c)|(b&d)|(c&d);return b^c^d;}function kt(t){return(t<20)?1518500249:(t<40)?1859775393:(t<60)?-1894007588:-899497514;}var x=AlignSHA1(msg);var w=new Array(80);var a=1732584193;var b=-271733879;var c=-1732584194;var d=271733878;var e=-1009589776;for(var i=0;i<x.length;i+=16){var olda=a;var oldb=b;var oldc=c;var oldd=d;var olde=e;for(var j=0;j<80;j++){if(j<16)w[j]=x[i+j];else w[j]=rol(w[j-3]^w[j-8]^w[j-14]^w[j-16],1);t=add(add(rol(a,5),ft(j,b,c,d)),add(add(e,w[j]),kt(j)));e=d;d=c;c=rol(b,30);b=a;a=t;}a=add(a,olda);b=add(b,oldb);c=add(c,oldc);d=add(d,oldd);e=add(e,olde);}SHA1Value=SHA1hex(a)+SHA1hex(b)+SHA1hex(c)+SHA1hex(d)+SHA1hex(e);return SHA1Value;}
////////////////////////////////////////////////////////////////////
function Env(name,env) {
    "undefined" != typeof process && JSON.stringify(process.env).indexOf("GITHUB") > -1 && process.exit(0);
    return new class {
        constructor(name,env) {
            this.name = name
            this.notifyStr = ''
            this.startTime = (new Date).getTime()
            Object.assign(this,env)
            console.log(`${this.name} 开始运行：\n`)
        }
        isNode() {
            return "undefined" != typeof module && !!module.exports
        }
        isQuanX() {
            return "undefined" != typeof $task
        }
        isSurge() {
            return "undefined" != typeof $httpClient && "undefined" == typeof $loon
        }
        isLoon() {
            return "undefined" != typeof $loon
        }
        getdata(t) {
            let e = this.getval(t);
            if (/^@/.test(t)) {
                const[, s, i] = /^@(.*?)\.(.*?)$/.exec(t),
                r = s ? this.getval(s) : "";
                if (r)
                    try {
                        const t = JSON.parse(r);
                        e = t ? this.lodash_get(t, i, "") : e
                    } catch (t) {
                        e = ""
                    }
            }
            return e
        }
        setdata(t, e) {
            let s = !1;
            if (/^@/.test(e)) {
                const[, i, r] = /^@(.*?)\.(.*?)$/.exec(e),
                o = this.getval(i),
                h = i ? "null" === o ? null : o || "{}" : "{}";
                try {
                    const e = JSON.parse(h);
                    this.lodash_set(e, r, t),
                    s = this.setval(JSON.stringify(e), i)
                } catch (e) {
                    const o = {};
                    this.lodash_set(o, r, t),
                    s = this.setval(JSON.stringify(o), i)
                }
            }
            else
                s = this.setval(t, e);
            return s
        }
        getval(t) {
            return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null
        }
        setval(t, e) {
            return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null
        }
        send(m, t, e = (() => {})) {
            if(m != 'get' && m != 'post' && m != 'put' && m != 'delete') {
                console.log(`无效的http方法：${m}`);
                return;
            }
            if(m == 'get' && t.headers) {
                delete t.headers["Content-Type"];
                delete t.headers["Content-Length"];
            } else if(t.body && t.headers) {
                if(!t.headers["Content-Type"]) t.headers["Content-Type"] = "application/x-www-form-urlencoded";
            }
            if(this.isSurge() || this.isLoon()) {
                if(this.isSurge() && this.isNeedRewrite) {
                    t.headers = t.headers || {};
                    Object.assign(t.headers, {"X-Surge-Skip-Scripting": !1});
                }
                let conf = {
                    method: m,
                    url: t.url,
                    headers: t.headers,
                    timeout: t.timeout,
                    data: t.body
                };
                if(m == 'get') delete conf.data
                $axios(conf).then(t => {
                    const {
                        status: i,
                        request: q,
                        headers: r,
                        data: o
                    } = t;
                    e(null, q, {
                        statusCode: i,
                        headers: r,
                        body: o
                    });
                }).catch(err => console.log(err))
            } else if (this.isQuanX()) {
                t.method = m.toUpperCase(), this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, {
                        hints: !1
                    })),
                $task.fetch(t).then(t => {
                    const {
                        statusCode: i,
                        request: q,
                        headers: r,
                        body: o
                    } = t;
                    e(null, q, {
                        statusCode: i,
                        headers: r,
                        body: o
                    })
                }, t => e(t))
            } else if (this.isNode()) {
                this.got = this.got ? this.got : require("got");
                const {
                    url: s,
                    ...i
                } = t;
                this.instance = this.got.extend({
                    followRedirect: false
                });
                this.instance[m](s, i).then(t => {
                    const {
                        statusCode: i,
                        request: q,
                        headers: r,
                        body: o
                    } = t;
                    e(null, q, {
                        statusCode: i,
                        headers: r,
                        body: o
                    })
                }, t => {
                    const {
                        message: s,
                        response: i
                    } = t;
                    e(s, i, i && i.body)
                })
            }
        }
        time(t) {
            let e = {
                "M+": (new Date).getMonth() + 1,
                "d+": (new Date).getDate(),
                "h+": (new Date).getHours(),
                "m+": (new Date).getMinutes(),
                "s+": (new Date).getSeconds(),
                "q+": Math.floor(((new Date).getMonth() + 3) / 3),
                S: (new Date).getMilliseconds()
            };
            /(y+)/.test(t) && (t = t.replace(RegExp.$1, ((new Date).getFullYear() + "").substr(4 - RegExp.$1.length)));
            for (let s in e)
                new RegExp("(" + s + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? e[s] : ("00" + e[s]).substr(("" + e[s]).length)));
            return t
        }
        async showmsg() {
            if(!this.notifyStr) return;
            let notifyBody = this.name + " 运行通知\n\n" + this.notifyStr
            if($.isNode()){
                var notify = require('./sendNotify');
                console.log('\n============== 推送 ==============')
                await notify.sendNotify(this.name, notifyBody);
            } else {
                this.msg(notifyBody);
            }
        }
        logAndNotify(str) {
            console.log(str)
            this.notifyStr += str
            this.notifyStr += '\n'
        }
        msg(e = t, s = "", i = "", r) {
            const o = t => {
                if (!t)
                    return t;
                if ("string" == typeof t)
                    return this.isLoon() ? t : this.isQuanX() ? {
                        "open-url": t
                    }
                 : this.isSurge() ? {
                    url: t
                }
                 : void 0;
                if ("object" == typeof t) {
                    if (this.isLoon()) {
                        let e = t.openUrl || t.url || t["open-url"],
                        s = t.mediaUrl || t["media-url"];
                        return {
                            openUrl: e,
                            mediaUrl: s
                        }
                    }
                    if (this.isQuanX()) {
                        let e = t["open-url"] || t.url || t.openUrl,
                        s = t["media-url"] || t.mediaUrl;
                        return {
                            "open-url": e,
                            "media-url": s
                        }
                    }
                    if (this.isSurge()) {
                        let e = t.url || t.openUrl || t["open-url"];
                        return {
                            url: e
                        }
                    }
                }
            };
            this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r)));
            let h = ["", "============== 系统通知 =============="];
            h.push(e),
            s && h.push(s),
            i && h.push(i),
            console.log(h.join("\n"))
        }
        getMin(a,b){
            return ((a<b) ? a : b)
        }
        getMax(a,b){
            return ((a<b) ? b : a)
        }
        padStr(num,length,padding='0') {
            let numStr = String(num)
            let numPad = (length>numStr.length) ? (length-numStr.length) : 0
            let retStr = ''
            for(let i=0; i<numPad; i++) {
                retStr += padding
            }
            retStr += numStr
            return retStr;
        }
        json2str(obj,c,encodeUrl=false) {
            let ret = []
            for(let keys of Object.keys(obj).sort()) {
                let v = obj[keys]
                if(v && encodeUrl) v = encodeURIComponent(v)
                ret.push(keys+'='+v)
            }
            return ret.join(c);
        }
        str2json(str,decodeUrl=false) {
            let ret = {}
            for(let item of str.split('&')) {
                if(!item) continue;
                let idx = item.indexOf('=')
                if(idx == -1) continue;
                let k = item.substr(0,idx)
                let v = item.substr(idx+1)
                if(decodeUrl) v = decodeURIComponent(v)
                ret[k] = v
            }
            return ret;
        }
        randomString(len,charset='abcdef0123456789') {
            let str = '';
            for (let i = 0; i < len; i++) {
                str += charset.charAt(Math.floor(Math.random()*charset.length));
            }
            return str;
        }
        randomList(a) {
            let idx = Math.floor(Math.random()*a.length)
            return a[idx]
        }
        wait(t) {
            return new Promise(e => setTimeout(e, t))
        }
        done(t = {}) {
            const e = (new Date).getTime(),
            s = (e - this.startTime) / 1e3;
            console.log(`\n${this.name} 运行结束，共运行了 ${s} 秒！`)
            if(this.isSurge() || this.isQuanX() || this.isLoon()) $done(t)
        }
    }(name,env)
}
