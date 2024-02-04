const Link = require('grenache-nodejs-link');
const { PeerRPCServer } = require('grenache-nodejs-ws');
const _ = require('lodash');

const link = new Link({
  grape: 'http://127.0.0.1:30001'
});
link.start();

const peer = new PeerRPCServer(link, {});
peer.init();

const service = peer.transport('server');
service.listen(_.random(1000) + 1024);

setInterval(() => {
  link.announce('rpc_test', service.port, {});
}, 1000);

service.on('request', (rid, key, payload, handler) => {
  console.log('Received payload:', payload);
  handler.reply(null, 'response from server');
});
