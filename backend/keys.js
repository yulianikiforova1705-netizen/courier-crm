const webPush = require('web-push');
const keys = webPush.generateVAPIDKeys();
console.log('Public Key:', keys.publicKey);
console.log('Private Key:', keys.privateKey);