// Red-black tree implementation of order book
const RBTree = require('bintrees').RBTree;
const { update } = require('lodash');
// Import necessary functions and operators from RxJS
const { Subject, merge } = require('rxjs');
const { bufferTime, map } = require('rxjs/operators');

// Sort buy orders by descending price, then ascending order ID
function compareBuyOrders(a, b) {
  try {
    if (!a || !b || !a.id || !b.id) {
      console.error('Invalid comparison attempt between', a, 'and', b);
      return 0;
    }
    if (b.price !== a.price) return b.price - a.price;
    return a.id.localeCompare(b.id);
  }
  catch (error) {
    console.error('Error comparing buy orders', error);
    return 0;
  }
}

// Sort sell orders by ascending price, then ascending order ID
function compareSellOrders(a, b) {
  try {
    if (!a || !b || !a.id || !b.id) {
      console.error('Invalid comparison attempt between', a, 'and', b);
      return 0;
    }
    if (a.price !== b.price) return a.price - b.price;
    return a.id.localeCompare(b.id);
  }
  catch (error) {
    console.error('Error comparing sell orders', error);
    return 0;
  }
}

// Sort orders by ascending order ID
function compareOrdersById(a, b) {
  try {
    if (!a || !b || !a.id || !b.id) {
      console.error('Invalid comparison attempt between', a, 'and', b);
      return 0;
    }
    return a.id.localeCompare(b.id);
  }
  catch (error) {
    console.error('Error comparing orders by ID', error);
    return 0;
  }
}

// Function to compare orders based on timestamp and sequenceNumber
function compareOrdersByTimeSeq(a, b) {
  try {
    if (a.timestamp === b.timestamp && a.sequenceNumber === b.sequenceNumber) {
      return 0;
    }
    if (a.timestamp === b.timestamp) {
      return a.sequenceNumber - b.sequenceNumber;
    }
    return new Date(a.timestamp) - new Date(b.timestamp);
  }
  catch (error) {
    console.error('Error comparing orders by timestamp and sequence number', error);
    return 0;
  }
}

const buyOrders = new RBTree(compareBuyOrders);
const sellOrders = new RBTree(compareSellOrders);
const ordersById = new RBTree(compareOrdersById);

/**
 * addOrderToBook
 * 
 * Functions like addOrderToBook and deleteOrderFromBook help encapsulate operations on order books 
 * Making it easier to ensure atomicity when modifying multiple trees.
 * 
 * @param {Order} order - The order to be added
 */
function addOrderToBooks(order) {
  try {
    const book = order.type === 'buy' ? buyOrders : sellOrders;
    book.insert(order);
    ordersById.insert(order);
    console.log(`Order added to book: ${order.id}`);
  } catch (error) {
    console.error('Failed to add order to book', error);
  }
}

function deleteOrderFromBooks(orderId) {
  try {
    const order = ordersById.find({ id: orderId });
    if (!order) throw new Error('Order not found');
    const book = order.type === 'buy' ? buyOrders : sellOrders;
    book.remove(order);
    ordersById.remove(order);
    console.log(`Order deleted from book: ${orderId}`);
  } catch (error) {
    console.error('Failed to delete order from book', error);
  }
}

function updateOrderInBooks(updateInfo) {
  try{
    // Attempt to find the order by ID
    const order = ordersById.find({ id: updateInfo.orderId });
    if (!order) {
      console.error(`Order not found: ${updateInfo.orderId}`);
      return;
    }

    // Update order details
    order.quantity = updateInfo.newQuantity;
    // Optionally, update other details if necessary

    // Since the order's price or quantity might have changed,
    // it might be necessary to remove and re-insert the order to maintain the correct order in the tree
    const book = order.type === 'buy' ? buyOrders : sellOrders;
    book.remove(order);
    book.insert(order);

    console.log(`Order updated in book: ${order.id}`);
  }
  catch (error) {
    console.error('Error updating order in books', error);
  }
}


/**
 * matchAndExecuteOrder
 * 
 * Matches an order with the opposite side of the order book and executes the trade if possible.
 * If the order is not fully matched, it is added to the order book.
 * 
 * @param {Order} newOrder - The order to be matched and executed
 */
function matchAndExecuteOrder(newOrder) {
  try{
    
    const oppositeBook = newOrder.type === 'buy' ? sellOrders : buyOrders;
    let currentBestMatch = newOrder.type === 'buy' ? oppositeBook.min() : oppositeBook.max();

    while (currentBestMatch) {
      // Determine if current best match is valid based on order type and price
      const isValidMatch = newOrder.type === 'buy' ? newOrder.price >= currentBestMatch.price 
                                                    : newOrder.price <= currentBestMatch.price;

      if (!isValidMatch) break;

      if (newOrder.quantity <= currentBestMatch.quantity) {
        console.log(`Full or partial match found for order ${newOrder.id} with ${currentBestMatch.id}, executing trade.`);
        
        // Calculate executed quantity before updating the currentBestMatch quantity
        const executedQuantity = newOrder.quantity;
        
        currentBestMatch.quantity -= newOrder.quantity;
        if (currentBestMatch.quantity === 0) {
          oppositeBook.remove(currentBestMatch);
          ordersById.remove(currentBestMatch.id);

          // Emit an event to indicate that the order has been fully exactly matched and removed
          emitOrderRemoved({
            orderId: currentBestMatch.id,
            matchedWith: newOrder.id, // Including this for context might be helpful
            executedQuantity: executedQuantity, // This might not be necessary but could be useful for logging/auditing
            removalTimestamp: new Date().toISOString()
          });
        } else {
          // Emit the updated event for partial matches where the best match still has remaining quantity
          emitOrderUpdated({
            orderId: currentBestMatch.id,
            newQuantity: currentBestMatch.quantity
          });
        }
        newOrder.quantity = 0;

        // Emit the matched event
        emitOrderMatched({
          orderId: newOrder.id,
          matchedWith: currentBestMatch.id,
          executedQuantity: executedQuantity
        });

        break; // Order fully matched
      } else {
        console.log(`Partial match found for order ${newOrder.id} with ${currentBestMatch.id}, executing trade.`);
        // Calculate executed quantity for the partial match
        const executedQuantity = currentBestMatch.quantity;

        newOrder.quantity -= currentBestMatch.quantity;
        oppositeBook.remove(currentBestMatch);
        ordersById.remove(currentBestMatch.id);

        // Emit the matched event for partial matches
        emitOrderMatched({
          orderId: newOrder.id,
          matchedWith: currentBestMatch.id,
          executedQuantity: executedQuantity
        });
      }

      // Move to next best match
      currentBestMatch = newOrder.type === 'buy' ? oppositeBook.min() : oppositeBook.max();
    }

    if (newOrder.quantity > 0) {
      console.log(`No (further) match found for order ${newOrder.id}, adding to book.`);
      addOrderToBooks(newOrder);

      // Emit the ORDER_ADDED event
      emitOrderAdded({
        orderId: newOrder.id,
        orderDetails: {
          peerId: newOrder.peerId,
          price: newOrder.price,
          quantity: newOrder.quantity,
          type: newOrder.type,
          sequenceNumber: newOrder.sequenceNumber,
          timestamp: newOrder.timestamp
        }
      });
    }
  }
  catch (error) {
    console.error('Error matching and executing order', error);
  }
}


function addOrderAfterMatching(order) {
  console.log(`Adding order: ${order.id}`);
  matchAndExecuteOrder(order);
}

function deleteOrder(orderId, requestTimestamp) {
  console.log(`Attempting to delete order with ID: ${orderId} at timestamp: ${requestTimestamp}`);
  const orderToDelete = ordersById.find({ id: orderId });
  if (!orderToDelete) {
    console.log(`Order not found or already deleted: ${orderId}`);
    return;
  }

  console.log(`Found order to delete:`, orderToDelete);

  const orderTimestamp = new Date(orderToDelete.timestamp);
  const deletionTimestamp = new Date(requestTimestamp);

  if (deletionTimestamp >= orderTimestamp) {
    console.log(`Deleting order: ${orderId}`);
    deleteOrderFromBooks(orderId);
  } else {
    console.log(`Deletion timestamp for order ${orderId} is earlier than the order's timestamp. Ignoring deletion.`);
  }
}



function treeToArray(tree) {
  const result = [];
  tree.each(node => result.push(node));
  return result;
}

const orderMatchedSubject$ = new Subject();
const orderUpdatedSubject$ = new Subject();
const orderAddedSubject$ = new Subject();
const orderRemovedSubject$ = new Subject();

function emitOrderMatched(matchInfo) {
  orderMatchedSubject$.next({
    action: 'order_matched',
    data: {
      orderId: matchInfo.orderId,
      matchedWith: matchInfo.matchedWith,
      executedQuantity: matchInfo.executedQuantity,
      timestamp: new Date().toISOString()
    }
  });
}

function emitOrderUpdated(updateInfo) {
  orderUpdatedSubject$.next({
    action: 'order_updated',
    data: {
      orderId: updateInfo.orderId,
      newQuantity: updateInfo.newQuantity,
      timestamp: new Date().toISOString()
    }
  });
}

function emitOrderAdded(orderInfo) {
  orderAddedSubject$.next({
    action: 'order_added',
    data: {
      orderId: orderInfo.orderId,
      peerId: orderInfo.orderDetails.peerId,
      price: orderInfo.orderDetails.price,
      quantity: orderInfo.orderDetails.quantity,
      type: orderInfo.orderDetails.type,
      sequenceNumber: orderInfo.orderDetails.sequenceNumber,
      timestamp: orderInfo.orderDetails.timestamp
    }
  });
}

function emitOrderRemoved(removalInfo) {
  orderRemovedSubject$.next({
    action: 'order_removed',
    data: {
      orderId: removalInfo.orderId,
      matchedWith: removalInfo.matchedWith,
      executedQuantity: removalInfo.executedQuantity,
      timestamp: new Date().toISOString()
    }
  });
}


// Define subjects
const addOrderSubject$ = new Subject();
const deleteOrderSubject$ = new Subject();

// Function to emit order additions
function emitAddOrder(order) {
    addOrderSubject$.next(order);
}

// Function to emit deletion requests into the stream
function emitDeleteOrder(deletionInfo) {
  deleteOrderSubject$.next(deletionInfo); // deletionInfo should include { orderId, timestamp }
}

// Define subjects for synchronizing order books with other instances
const syncOrderAddedSubject$ = new Subject();
const syncOrderUpdatedSubject$ = new Subject();
const syncOrderRemovedSubject$ = new Subject();

//Function to synchronize order added events
function synchronizeAddOrder(order) {
  syncOrderAddedSubject$.next(order);
}

//Function to synchronize order updated events
function synchronizeUpdateOrder(order) {
  syncOrderUpdatedSubject$.next(order);
}

//Function to synchronize order removed events
function synchronizeRemoveOrder(order) {
  syncOrderRemovedSubject$.next(order);
}

// Merging the add and delete streams, buffer them, and then sort each batch before processing
const orderOperationsStream$ = merge(
  addOrderSubject$.pipe(map(order => ({ operationType: 'add', payload: order }))), // Mark each order addition with a type
  deleteOrderSubject$.pipe(map(deletionInfo => ({ operationType: 'delete', payload: deletionInfo }))), // Mark each deletion with a type
  syncOrderAddedSubject$.pipe(map(orderInfo => ({ operationType: 'syncAdd', payload: orderInfo }))), // Mark each sync order addition with a type
  syncOrderUpdatedSubject$.pipe(map(updateInfo => ({ operationType: 'syncUpdate', payload: updateInfo }))), // Mark each sync order update with a type
  syncOrderRemovedSubject$.pipe(map(removalInfo => ({ operationType: 'syncRemove', payload: removalInfo }))) // Mark each sync order removal with a type
).pipe(
  bufferTime(1000),
  map(bufferedOperations => bufferedOperations.sort((a, b) => compareOrdersByTimeSeq(a.payload, b.payload))) // Ensure the sorting logic correctly references the timestamp within the payload.
);

// Process the sorted and buffered orders
orderOperationsStream$.subscribe({
  next: sortedOperations => {
    sortedOperations.forEach(operation=>{
      try {
        processOperation(operation);
      }
      catch (error) {
        console.error('Error processing operation', operation, error);
      }
    });
  },
  error: err => {
    console.error('Error processing operations stream', err);
  }
});

function processOperation(operation) {
  try {
    if (!operation || !operation.payload) throw new Error("Invalid operation payload");

    const { operationType, payload } = operation;
    console.log(`Processing ${operationType}:`, payload);

    switch (operationType) {
      case 'add':
        addOrderAfterMatching(payload);
        break;
      case 'delete':
        deleteOrder(payload.orderId, payload.timestamp);
        break;
      case 'syncAdd':
        const newOrder = new Order(
          payload.peerId,
          payload.price,
          payload.quantity,
          payload.type,
          payload.sequenceNumber
        );
        newOrder.timestamp = payload.timestamp; // Ensure the timestamp from client is preserved
        newOrder.id = payload.orderId;
        addOrderToBooks(newOrder);
        break; 
      case 'syncUpdate':
        updateOrderInBooks(payload);
        break;
      case 'syncRemove':
        deleteOrder(payload.orderId, payload.removalTimestamp);
        break;
      default:
        console.warn(`Unknown operation type: ${operationType}`);
    }
  } catch (error) {
    console.error(`Error processing operation: ${error.message}`, operation);
  }
}


module.exports = { emitAddOrder, emitDeleteOrder, treeToArray, orderMatchedSubject$, orderUpdatedSubject$, orderAddedSubject$, orderRemovedSubject$, synchronizeAddOrder, synchronizeUpdateOrder, synchronizeRemoveOrder};
