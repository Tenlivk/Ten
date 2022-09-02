/*
物流积分兑换京豆
@Leaf

cron: 0 0,2 0* * *
*/
const got = require("got");
const $ = new Env("物流积分兑换京豆");

let defaultUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.23(0x1800172f) NetType/WIFI Language/zh_CN'

let maxThread = 20

let NUM_MAX_COMMON_RETRY = 2
let WAIT_TIME_COMMON_RETRY = 200

let iosVerList = ["15.1.1", "14.5.1", "14.4", "14.3", "14.2", "14.1", "14.0.1"]
let clientVerList = ["10.3.0", "10.2.7", "10.2.4"]
let iphoneVerList = ["8","9","10","11","12","13"]
///////////////////////////////////////////////////////////////////
class UserClass {
    constructor(paramIn) {
        Object.assign(this,paramIn)
        this.name = decodeURIComponent(this.pt_pin)
        this.valid = false
        
        this.uuid = $.randomString(40)
        this.addressid = $.randomString(10,'123456789')
        this.iosVer = $.randomList(iosVerList)
        this.iosVer_ = this.iosVer.replace('.', '_')
        this.iphone = $.randomList(iphoneVerList)
        this.sid = $.randomString(32)
        this.un_area = $.randomString(2,'1234567890') + '-' + $.randomString(4,'1234567890') + '-' + $.randomString(4,'1234567890') + '-' + $.randomString(5,'1234567890')
        this.UA = `jdapp;iPhone;10.1.4;${this.iosVer};${this.uuid};network/wifi;model/iPhone${this.iphone},1;addressid/${this.addressid};appBuild/167707;jdSupportDarkMode/0;Mozilla/5.0 (iPhone; CPU iPhone OS ${this.iosVer_} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/null;supportJDSHWK/1`
    }
    
    populateUrlObject(paramIn={}){
        let host = paramIn.url.replace('//','/').split('/')[1]
        let urlObject = {
            url: paramIn.url,
            headers: {
                'Host' : host,
                'access' : 'H5',
                'source-client' : '2',
                'jexpress-report-time' : Date.now(),
                'd_model' : 'iPhone'+this.iphone,
                'LOP-DN' : 'jingcai.jd.com',
                'User-Agent' : this.UA,
                'partner' : '',
                'screen' : '390*844',
                'Cookie' : this.cookie,
                'X-Requested-With' : 'XMLHttpRequest',
                'version' : '1.0.0',
                'uuid' : ''+Date.now()+$.randomString({len:13,charset:'0123456789'}),
                'ClientInfo' : JSON.stringify({"appName":"jingcai","client":"m"}),
                'd_brand' : 'iPhone',
                'AppParams' : JSON.stringify({"appid":158,"ticket_type":"m"}),
                'sdkversion' : '1.0.7',
                'area' : $.randomPattern({pattern:'xx_xxxx_xxxx_xxxxx',charset:'0123456789'}),
                'client' : 'iOS',
                'Referer' : 'https://jingcai-h5.jd.com/',
                'eid' : '',
                'osversion' : this.iosVer,
                'networktype' : 'wifi',
                'jexpress-trace-id' : $.randomPattern({pattern:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}),
                'Accept-Language' : 'zh-CN,zh-Hans;q=0.9',
                'Origin' : 'https://jingcai-h5.jd.com',
                'app-key' : 'jexpress',
                'event-id' : $.randomPattern({pattern:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}),
                'clientVersion' : '11.1.2',
                'Connection' : 'keep-alive',
                'Content-Type' : 'application/json;charset=utf-8',
                'build' : '168158',
                'biz-type' : 'service-monitor',
                'forcebot' : '0',
            },
            timeout: 5000,
        }
        if(paramIn.headers) {
            Object.assign(urlObject.headers,paramIn.headers)
        }
        if(paramIn.body) {
            let str = paramIn.body
            let contentType = paramIn['Content-Type'] || 'application/json;charset=utf-8'
            if(typeof paramIn.body === "object") {
                if(contentType.includes('json')) {
                    str = JSON.stringify(paramIn.body)
                } else {
                    let connector = paramIn.connector===undefined ? '&' : paramIn.connector
                    let encodeUrl = paramIn.encodeUrl===undefined ? true : paramIn.encodeUrl
                    let isSort = paramIn.isSort===undefined ? true : paramIn.isSort
                    let objParam = {obj:paramIn.body,connector,encodeUrl,isSort}
                    str = $.json2str(objParam)
                }
            }
            urlObject.body = str
            urlObject.headers['Content-Type'] =  contentType
            //urlObject.headers['Content-Length'] = urlObject.body ? urlObject.body.length : 0
        }
        return urlObject;
    }
    
    async taskApi(paramIn={}) {
        let paramOut = {
            statusCode: -1,
        }
        let numRetry = 0
        try {
            while(paramOut.statusCode == -1 && numRetry <= NUM_MAX_COMMON_RETRY) {
                numRetry++
                await got[paramIn.method](paramIn.urlObject).then(async resp => {
                    paramOut.statusCode = resp?.statusCode || paramOut.statusCode
                    paramOut.resp = resp
                    if(resp?.statusCode == 200) {
                        if(resp?.body) {
                            try {
                                paramOut.result = JSON.parse(resp.body)
                            } catch(e) {
                                paramOut.result = resp.body
                            }
                        } else {
                            if(!paramIn.allowNull) {
                                console.log(`账号${this.index}[${this.name}]调用[${paramIn.method}][${paramIn.fn}]出错，返回为空`)
                                if(numRetry < NUM_MAX_COMMON_RETRY) {
                                    console.log(`账号${this.index}[${this.name}]重试第${numRetry}次`)
                                    //允许重试，将状态码设置为-1
                                    paramOut.statusCode = -1
                                }
                            }
                        }
                    } else {
                        console.log(`账号${this.index}[${this.name}]调用[${paramIn.method}][${paramIn.fn}]出错，返回状态码[${paramOut.statusCode}]`)
                        if(numRetry <= NUM_MAX_COMMON_RETRY) {
                            console.log(`账号${this.index}[${this.name}]重试第${numRetry}次`)
                            //允许重试，将状态码设置为-1
                            paramOut.statusCode = -1
                            await $.wait(WAIT_TIME_COMMON_RETRY);
                        }
                    }
                }, async err => {
                    paramOut.statusCode = err?.response?.statusCode || paramOut.statusCode
                    paramOut.err = err
                    if(paramOut.statusCode != -1) {
                        console.log(`账号${this.index}[${this.name}]调用[${paramIn.method}][${paramIn.fn}]出错，返回状态码[${paramOut.statusCode}]`)
                        if(numRetry <= NUM_MAX_COMMON_RETRY) {
                            console.log(`账号${this.index}[${this.name}]重试第${numRetry}次`)
                            //允许重试，将状态码设置为-1
                            paramOut.statusCode = -1
                            await $.wait(WAIT_TIME_COMMON_RETRY);
                        }
                    } else {
                        console.log(`账号${this.index}[${this.name}]调用[${paramIn.method}][${paramIn.fn}]没有返回，重试第${numRetry}次`)
                    }
                })
            }
        } catch(e) {
            console.log(e)
        } finally {
            return Promise.resolve(paramOut);
        }
    }
    
    async userAccount(paramIn={}) {
        let paramOut = {}
        try {
            let urlObjParam = {
                url : `https://lop-proxy.jd.com/JingIntegralApi/userAccount`,
                body: [{"pin":"$cooMrdGatewayUid$"}],
            }
            let urlObject = this.populateUrlObject(urlObjParam)
            let taskApiParam = {
                fn : 'userAccount',
                method : 'post',
                urlObject : urlObject,
            }
            paramOut = await this.taskApi(taskApiParam)
            if(paramOut.result && typeof paramOut.result === 'object') {
                let result = paramOut.result
                if(result.success) {
                    this.integral = result.content.integral
                    this.jdBean = result.content.jdBean
                    //console.log(`积分: ${this.integral}，京豆: ${this.jdBean}`)
                    if(this.integral >= 100) {
                        let exchangeIntegral = $.getMin(this.integral,5000)
                        //console.log(`兑换${exchangeIntegral}积分到京豆`)
                        await this.transfer({mode:'integral2Bean',amount:exchangeIntegral})
                    } else {
                        console.log(`账号${this.index}[${this.name}]积分${this.integral}不足最低门槛，不兑换京豆`)
                    }
                } else {
                    console.log(`账号${this.index}[${this.name}]获取账户信息失败：${result?.error_response?.zh_desc}`)
                }
            }
        } catch(e) {
            console.log(e)
        } finally {
            return Promise.resolve(paramOut)
        }
    }
    
    async transfer(paramIn={}) {
        let paramOut = {}
        try {
            let type = paramIn.mode=='bean2Integral' ? 1 : 2
            let title = type==1 ? '京豆兑换物流积分' : '物流积分兑换京豆'
            let urlObjParam = {
                url : `https://lop-proxy.jd.com/JingIntegralApi/transfer`,
                body: [{"pin":"$cooMrdGatewayUid$","businessNo":$.randomPattern({pattern:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}),"type":type,"transferNumber":paramIn.amount,"title":title}]
            }
            let urlObject = this.populateUrlObject(urlObjParam)
            urlObject.headers['Content-Length'] = urlObject.body.length + 16
            let taskApiParam = {
                fn : 'transfer',
                method : 'post',
                urlObject,
            }
            paramOut = await this.taskApi(taskApiParam)
            if(paramOut.result && typeof paramOut.result === 'object') {
                let result = paramOut.result
                if(result.code==1) {
                    if(type==1) {
                        this.jdBean   -= paramIn.amount
                        this.integral += paramIn.amount
                    } else {
                        this.jdBean   += paramIn.amount
                        this.integral -= paramIn.amount
                    }
                    console.log(`账号${this.index}[${this.name}]${paramIn.amount}${title}成功`)
                } else {
                    //console.log(urlObject)
                    let msg = result.errorMsg || result.msg || '没有返回错误原因' 
                    console.log(`账号${this.index}[${this.name}]${paramIn.amount}${title}失败[${result?.code}]：${msg}`)
                }
            }
        } catch(e) {
            console.log(e)
        } finally {
            return Promise.resolve(paramOut)
        }
    }
    
    async userTask() {
        try {
            //console.log(`\n===== 账号${this.index}[${this.name}] =====`)
            await this.userAccount();
        } catch(e) {
            console.log(e)
        } finally {
            return Promise.resolve()
        }
    }
}

!(async () => {
    if (typeof $request !== "undefined") {
        await GetRewrite()
    }else {
        if(!(await $.checkEnv())) return;
        
        let taskall = []
        for(let user of $.userList) {
            taskall.push(user.userTask())
            if(taskall.length >= maxThread) {
                await Promise.all(taskall)
                taskall = []
            }
        }
        await Promise.all(taskall)
        taskall = []
    }
})()
.catch((e) => console.log(e))
.finally(() => $.done())

////////////////////////////////////////////////////////////////////
function Env(name,env) {
    "undefined" != typeof process && JSON.stringify(process.env).indexOf("GITHUB") > -1 && process.exit(0);
    return new class {
        constructor(name,env) {
            this.name = name
            this.notifyStr = ''
            this.envSplitor = ['&','\n']
            //默认读取环境变量的JD_COOKIE
            this.userCookie = process.env.JD_COOKIE || '';
            this.userList = []
            this.userIdx = 0
            this.userCount = 0
            Object.assign(this,env)
            this.startTime = Date.now()
            console.log(`${this.name} 开始运行：\n`)
        }
        async checkEnv(paramIn={}) {
            if(this.userCookie) {
                let splitor = this.envSplitor[0];
                if(paramIn.splitor) {
                    splitor = paramIn.splitor
                } else {
                    for(let sp of this.envSplitor) {
                        if(this.userCookie.indexOf(sp) > -1) {
                            splitor = sp;
                            break;
                        }
                    }
                }
                for(let userCookies of this.userCookie.split(splitor)) {
                    if(userCookies) {
                        let pt_key = userCookies.match(/pt_key=([\w\-]+)/)
                        let pt_pin = userCookies.match(/pt_pin=([\w\-\%]+)/)
                        if(pt_key && pt_pin) {
                            let param = {
                                cookie: userCookies,
                                pt_key: pt_key[1],
                                pt_pin: pt_pin[1],
                                index: ++this.userIdx,
                            }
                            this.userList.push(new UserClass(param))
                        }
                    }
                }
                this.userCount = this.userList.length
            } else {
                console.log('未找到有效的CK')
                return false;
            }
            console.log(`共找到${this.userCount}个账号`)
            return true
        }
        async showmsg(paramIn={}) {
            if(!this.notifyStr) return;
            let notifyBody = this.name + " 运行通知\n\n" + this.notifyStr
            var notify = require('./sendNotify');
            console.log('\n============== 推送 ==============')
            await notify.sendNotify(this.name, notifyBody);
        }
        async done(paramIn={}) {
            await this.showmsg();
            const e = (new Date).getTime(),
            s = (e - this.startTime) / 1e3;
            console.log(`\n${this.name} 运行结束，共运行了 ${s} 秒！`)
            process.exit(0)
        }
        logAndNotify(str) {
            console.log(str)
            this.notifyStr += str + '\n'
        }
        logAndNotifyWithTime(str) {
            this.logAndNotify(`[${this.time({'format':'hh:mm:ss.S'})}]${str}`)
        }
        logWithTime(str) {
            console.log(`[${this.time({'format':'hh:mm:ss.S'})}]${str}`)
        }
        getMin(a,b){
            return ((a<b) ? a : b)
        }
        getMax(a,b){
            return ((a<b) ? b : a)
        }
        padStr(paramIn={}) {
            let numStr = String(paramIn.str)
            let numPad = (paramIn.len>numStr.length) ? (len-numStr.length) : 0
            let retStr = ''
            for(let i=0; i<numPad; i++) {
                retStr += (paramIn.padding || 0)
            }
            retStr += numStr
            return retStr;
        }
        ecPadStr(str,len,padding=0) {
            let numStr = String(str)
            let numPad = (len>numStr.length) ? (len-numStr.length) : 0
            let retStr = ''
            for(let i=0; i<numPad; i++) {
                retStr += (padding || 0)
            }
            retStr += numStr
            return retStr;
        }
        json2str(paramIn={}) {
            let ret = []
            let obj = paramIn.obj
            let connector = paramIn.connector || '&'
            let keys = Object.keys(obj)
            if(paramIn.isSort) keys = keys.sort()
            for(let key of keys) {
                let v = obj[key]
                if(v && paramIn.encodeUrl) v = encodeURIComponent(v)
                ret.push(key+'='+v)
            }
            return ret.join(connector);
        }
        str2json(paramIn={}) {
            let ret = {}
            let connector = paramIn.connector || '&'
            for(let item of paramIn.str.split(connector)) {
                if(!item) continue;
                let idx = item.indexOf('=')
                if(idx == -1) continue;
                let k = item.substr(0,idx)
                let v = item.substr(idx+1)
                if(paramIn.decodeUrl) v = decodeURIComponent(v)
                ret[k] = v
            }
            return ret;
        }
        randomPattern(paramIn={}) {
            let charset = paramIn.charset || 'abcdef0123456789'
            let str = ''
            for(let chars of paramIn.pattern) {
                if(chars == 'x') {
                    str += charset.charAt(Math.floor(Math.random()*charset.length));
                } else if(chars == 'X') {
                    str += charset.charAt(Math.floor(Math.random()*charset.length)).toUpperCase();
                } else {
                    str += chars
                }
            }
            return str
        }
        randomString(paramIn={}) {
            let charset = paramIn.charset || 'abcdef0123456789'
            let str = '';
            for (let i = 0; i < paramIn.len; i++) {
                str += charset[Math.floor(Math.random()*charset.length)];
            }
            return str;
        }
        randomList(l) {
            let idx = Math.floor(Math.random()*l.length)
            return l[idx]
        }
        wait(t) {
            return new Promise(e => setTimeout(e, t))
        }
        randomWait(basetime,randomtime) {
            if(basetime == 0) return;
            let t = Math.floor(Math.random()*randomtime) + basetime
            return this.wait(t)
        }
        time(paramIn={}) {
            let str = paramIn.format
            let xt = paramIn.time ? new Date(paramIn.time) : new Date
            let e = {
                "M+": xt.getMonth() + 1,
                "d+": xt.getDate(),
                "h+": xt.getHours(),
                "m+": xt.getMinutes(),
                "s+": xt.getSeconds(),
                "q+": Math.floor((xt.getMonth() + 3) / 3),
                S: xt.getMilliseconds()
            };
            /(y+)/.test(str) && (str = str.replace(RegExp.$1, (xt.getFullYear() + "").substr(4 - RegExp.$1.length)));
            for (let s in e)
                new RegExp("(" + s + ")").test(str) && (str = str.replace(RegExp.$1, 1 == RegExp.$1.length ? e[s] : ("00" + e[s]).substr(("" + e[s]).length)));
            return str
        }
    }(name,env)
}