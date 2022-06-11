var fs = require('fs');
var path = require('path');
const mongoose = require('mongoose');

var wechat = require('wechat');
var ejs = require('ejs');
var alpha = require('alpha');
var VIEW_DIR = path.join(__dirname, '..', 'views');
var axios = require("axios").default;

var config = require('../config');
var WechatAPI = require('wechat-api');

var wxApi = new WechatAPI(config.mp.appid, config.mp.sec);
const conn = mongoose.createConnection(config.mongodb);
const UserModel = conn.model('w3ns_user', {
  FromUserName: String,
  wallet: String,
  pinataKey: String,
  pinataSec: String,
});

const pinataSDK = require('@pinata/sdk');

var oauth = new wechat.OAuth(config.appid, config.appsecret);

var List = require('wechat').List;
List.add('view', [
  ['没有找到相关活动', function (info, req, res) {
    res.nowait('暂无活动');
  }]
]);

const menu = {
  'help': '查看帮助',
  'wallet': '配置钱包地址指令: wallet 0xXXXX',
  'pinataKey': '配置pinataKey指令: pinataKey xxxx',
  'pinataSec': '配置pinataSec指令: pinataSec yyyy',
  'config': '查看配置',
  'nft': '铸造 NFT',
  'ipfs': '上传图片到 IPFS',
  '我的': '显示我的 NFT',
}

let helpMsg = ''
Object.keys(menu).forEach(key => {
  const str = `${key}: \n ${menu[key]}\n\n`
  helpMsg += str
})

var callbackTpl = ejs.compile(fs.readFileSync(path.join(VIEW_DIR, 'callback.html'), 'utf-8'));

exports.callback = function (req, res) {
  res.writeHead(200);
  oauth.getAccessToken(req.query.code, function (err, result) {
    res.end(callbackTpl(req.query));
  });
};

exports.reply = wechat(config.mp, wechat.text(async (msg, req, res) => {
  console.log(msg);
  const { FromUserName } = msg
  const prefixArr = msg.Content.split(' ')
  const prefixWhiteList = ['wallet', 'pinataKey', 'pinataSec']
  let user = await UserModel.findOne({ FromUserName })
  if (prefixWhiteList.includes(prefixArr[0])) {
    const value = prefixArr[1]
    const params = { FromUserName }
    params[prefixArr[0]] = prefixArr[1]
    if (user) {
      user[prefixArr[0]] = value
    } else {
      user = new UserModel(params)
    }
    await user.save()
    return res.reply(`设定成功, 新的 config 为 ${JSON.stringify(user)}`)
  }

  if (!user || !user.wallet) {
    return res.reply('您还未设置钱包地址，请通过输入 "wallet 0xXXXX", 来设置钱包地址')
  }

  switch (msg.Content) {
    case 'help':
      return res.reply(helpMsg)
    case 'config':
      return res.reply(JSON.stringify(user))
    case '我的':
      return res.reply(`<a href="https://m.web3nft.social/?userWalletAddress=${user.wallet}">点击查看钱包${user.wallet} 的所有 NFT</a>`)
    case 'nft':
      req.wxsession.step = 'inputTitle'
      return res.reply('请输入 NFT 的标题')
    case 'ipfs':
      req.wxsession.step = 'ipfsTitle'
      return res.reply('请输入文件标题')
  }

  switch (req.wxsession.step) {
    case 'ipfsTitle':
      req.wxsession.name = msg.Content
      req.wxsession.step = 'ipfsUploadImg'
      return res.reply('请上传 IPFS 图片')
      break;
    case 'inputTitle':
      req.wxsession.title = msg.Content
      req.wxsession.step = 'inputDesc'
      return res.reply('请输入 nft 的描述')
      break;
    case 'inputDesc':
      req.wxsession.desc = msg.Content
      req.wxsession.step = 'walletAddress'
      return res.reply('请输入 nft 所有者的钱包地址, 输入"默认"则使用默认钱包地址')
      break;
    case 'walletAddress':
      req.wxsession.walletAddress = msg.Content
      if (msg.Content === '默认') {
        req.wxsession.walletAddress = user.wallet
      }
      req.wxsession.step = 'nftUploadImg'
      return res.reply('请上传 NFT 图片')
      break;
  }
  return res.reply('未知操作')
}).image(async function (message, req, res) {
  const { FromUserName } = message
  console.log(`====> message :`, message)
  let options = ''
  switch (req.wxsession.step) {
    case 'nftUploadImg':
      var mint_to_address = req.wxsession.walletAddress
      options = {
        method: 'POST',
        url: 'https://api.nftport.xyz/v0/mints/easy/urls',
        headers: { 'Content-Type': 'application/json', Authorization: '3dec95ae-f114-4cbf-9ff5-19fbc1f561eb' },
        data: {
          chain: 'rinkeby',
          name: req.wxsession.desc,
          description: req.wxsession.desc,
          file_url: message.PicUrl,
          mint_to_address
        }
      };

      axios.request(options).then(function (response) {
        const { data: { transaction_external_url } } = response
        const text = `提交铸造成功 ${transaction_external_url}`
        wxApi.sendText(FromUserName, text)
      }).catch(function (error) {
        console.error(error);
      });

      return res.reply(`铸造您的 NFT 中，大概需要五分钟，可以五分钟后 <a href="https://m.web3nft.social/?userWalletAddress=${mint_to_address
        }">点击此链接</a>查看您钱包的所有nft, \n pc端web3主页请电脑端浏览器打开 \n https://dev.web3nft.social/${mint_to_address}`)

    case 'ipfsUploadImg':
      let user = await UserModel.findOne({ FromUserName })
      const { pinataKey, pinataSec } = user
      if (!pinataKey) {
        return res.reply('请先设置 pinataKey, 格式为: "pinataKey ${pinataKey}"')
      }
      if (!pinataSec) {
        return res.reply('请先设置 pinataSec, 格式为: "pinataSec ${pinataSec}"')
      }
      const pinata = pinataSDK(pinataKey, pinataSec);

      options = {
        pinataMetadata: {
          name: req.wxsession.name || 'test',
          keyvalues: {
            FromUserName
          }
        },
        pinataOptions: {
          cidVersion: 0
        }
      };

      axios.request({
        method: "get",
        url: message.PicUrl,
        responseType: "stream"
      }).then(async res => {
        console.log(`====>  done request:`)
        const rzPinata = await pinata.pinFileToIPFS(res.data, options);
        console.log(`====>  done pin:`, rzPinata)

        const url = `https://gateway.pinata.cloud/ipfs/${rzPinata.IpfsHash}`
        const text = `上传到 IPFS 成功: ${url}`
        const rz = await wxApi.sendText(FromUserName, text);
        console.log(`====> rz :`, rz)
        return rz
      })
      return res.reply('上传文件到 IPFS 中，请稍等...')
  }
  return res.reply('未知操作')
}).location(function (message, req, res) {
  console.log(message);
  res.reply(JSON.stringify(message));
}).voice(function (message, req, res) {
  console.log(message);
  res.reply(JSON.stringify(message));

}).link(function (message, req, res) {
  console.log(message);
  res.reply(JSON.stringify(message));
}).event(function (message, req, res) {
  if (message.Event === 'subscribe') {
    res.reply(helpMsg);
  } else if (message.Event === 'unsubscribe') {
    res.reply('Bye!');
  } else {
    res.reply('暂未支持! Coming soon!');
  }
}));

var tpl = ejs.compile(fs.readFileSync(path.join(VIEW_DIR, 'detail.html'), 'utf-8'));
exports.detail = function (req, res) {
  var id = req.query.id || '';
  var info = alpha.access(alpha.getKey(id));
  if (info) {
    res.writeHead(200);
    res.end(tpl(info));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
};

var loginTpl = ejs.compile(fs.readFileSync(path.join(VIEW_DIR, 'login.html'), 'utf-8'));

exports.login = function (req, res) {
  res.writeHead(200);
  var redirect = 'https://jjf-tech.cn/wechat/callback';
  res.end(loginTpl({ authorizeURL: oauth.getAuthorizeURL(redirect, 'state', 'snsapi_userinfo') }));
};
