const Link = require('grenache-nodejs-link');
const { PeerRPCServer } = require('grenache-nodejs-ws');
const _ = require('lodash');
const Order = require('../models/Order'); 
const { emitAddOrder, emitDeleteOrder } = require('../services/ordermanagement');

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
      // Assuming payload.order contains all necessary information
      const newOrder = new Order(
        payload.order.peerId, 
        payload.order.price, 
        payload.order.quantity, 
        payload.order.type, 
        payload.order.sequenceNumber
      );
      newOrder.timestamp = payload.order.timestamp; // Ensure the timestamp from client is preserved
      emitAddOrder(newOrder);
      break;
    case 'DELETE_ORDER':
      // For DELETE_ORDER, directly use payload.orderId
      // Include the deletion timestamp in the deletion event
      emitDeleteOrder({ orderId: payload.orderId, timestamp: payload.timestamp });
      break;
  }

  handler.reply(null, 'Order processed');
});
