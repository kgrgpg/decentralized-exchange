const { from, interval, timer, of } = require('rxjs');
const { switchMap, catchError, retryWhen, delayWhen, tap, finalize } = require('rxjs/operators');
const Link = require('grenache-nodejs-link');
const { PeerRPCClient, PeerSub } = require('grenache-nodejs-ws');
const Order = require('../models/Order');
const moment = require('moment');
const crypto = require('crypto');

// Initialize Grenache Link and PeerRPCClient
const link = new Link({ grape: 'http://192.168.1.29:40001' });
link.start();
const peer = new PeerRPCClient(link, {});
peer.init();

// Initialize PeerSub for listening to broadcasts
const peerSub = new PeerSub(link, {});
peerSub.init();

// Subscribe to the desired topic
peerSub.sub('order_updates', { timeout: 10000 });

peerSub.on('connected', () => {
  console.log('Subscription connected');
});

peerSub.on('disconnected', () => {
  console.log('Subscription disconnected');
});

// Handle incoming messages
peerSub.on('message', (msg) => {
  console.log('Received message:', msg);
  // Here you can add logic to process the message
});

// Generate a unique identifier for the peer
const peerId = crypto.createHash('sha256').update(`${moment().toISOString()}${Math.random()}`).digest('hex').substr(0, 6);
let sequenceNum = 1;
let addedOrderIds = []; // Store for added order IDs

// Function to create an observable for order requests
const createOrderObservable = (actionType) => {
  let payload;
  if (actionType === 'ADD_ORDER') {
    const order = new Order(peerId, 100 + Math.floor(Math.random() * 10), 1 + Math.floor(Math.random() * 5), Math.random() > 0.5 ? 'buy' : 'sell', sequenceNum++);
    payload = { type: actionType, order: order };
    // Store the order ID for future deletion
    addedOrderIds.push(order.id);
  } else {
    // Choose a random order ID from the list of added orders for deletion
    const orderIdToDelete = addedOrderIds.length > 0 ? addedOrderIds.shift() : 'no-valid-order'; // Fallback if no valid order exists
    payload = { type: actionType, orderId: orderIdToDelete, timestamp: new Date().toISOString() };
  }

  return from(new Promise((resolve, reject) => {
    peer.request('order_service', payload, { timeout: 10000 }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  })).pipe(
    catchError(error => {
      // Log and rethrow error for retryWhen to catch
      console.error('Error in request:', error);
      return of(`Request failed: ${error.message}`); // Handling the error and transforming it into a recoverable state
    })
  );
};

// Interval observable for sending orders
const orderRequestInterval$ = interval(1000).pipe(
  switchMap(() => createOrderObservable(Math.random() > 0.5 ? 'ADD_ORDER' : 'DELETE_ORDER')),
  retryWhen(errors =>
    errors.pipe(
      tap(err => console.log(`Error encountered: ${err.message}. Retrying...`)),
      delayWhen((_, attemptIndex) => timer(attemptIndex * 1000)),
      finalize(() => console.log('All retries completed or an unrecoverable error encountered.'))
    )
  )
);

// Subscription to the interval observable
orderRequestInterval$.subscribe({
  next: response => console.log('Response from server:', response),
  error: err => console.error('Observable encountered an error:', err),
  complete: () => console.log('Observable completed')
});


