const Link = require('grenache-nodejs-link');
const { PeerRPCServer } = require('grenache-nodejs-ws');
const _ = require('lodash');
const Order = require('../models/order');
const { addOrder, deleteOrder } = require('../services/ordermanagement');


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
    
    switch (payload.type) {
      case 'ADD_ORDER':
        addOrder(new Order(payload.order.id, payload.order.price, payload.order.quantity, payload.order.type));
        break;
      case 'DELETE_ORDER':
        deleteOrder(payload.orderId);
        break;
      // Additional cases can be added for other event types
    }
  
    handler.reply(null, 'Order processed');
  });
  
