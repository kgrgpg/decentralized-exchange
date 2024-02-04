const Link = require('grenache-nodejs-link');
const { PeerRPCClient } = require('grenache-nodejs-ws');
const Order = require('../models/order');


const link = new Link({
  grape: 'http://127.0.0.1:30001'
});
link.start();

const peer = new PeerRPCClient(link, {});
peer.init();

setInterval(() => {
    peer.request('rpc_test', { type: 'ADD_ORDER', order: new Order('3', 102, 3, 'buy') }, { timeout: 10000 }, (err, data) => {
        if (err) {
          console.error('Request Error:', err);
          return;
        }
        console.log('Response from server:', data);
      });
      
}, 2000);

  