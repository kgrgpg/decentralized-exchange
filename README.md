# README for Distributed Exchange System

### Workflow

1. **Order Submission**: Clients submit buy or sell orders through `PeerRPCClient`.
2. **Order Processing**: Servers receive orders, match them using an internal order book managed with red-black trees, and process them accordingly.
3. **Event Broadcasting**: Upon order matching, updating, or adding, servers broadcast these events to all clients and other servers using `PeerPub`.
4. **Event Listening**: Clients and secondary servers listen for updates using `PeerSub` and update their state based on the received messages.

## Running the Project

1. **Setup Grenache Grape**: Ensure you have at multiple instances of Grenache Grape running and interconnected.
2. **Start Server(s)**: Run `node server.js` . Make sure to start another server within 60 seconds because the first server is expecting a sub topic.
3. **Run Client(s)**: Execute `node client.js` to start a client instance. Multiple clients can be started to simulate real-world usage.

## Server.js

### Initialization and Configuration

- **Grenache Link Setup**: Establishes a link to the Grape DHT network. This allows the server to announce its services and discover other services within the network.

- **PeerRPCServer Initialization**: Initializes a Grenache Peer RPC Server. This server listens for incoming RPC requests, such as adding or deleting orders from clients.

- **Service Announcement**: Regularly announces the `order_service` to the Grape network, making it discoverable by clients or other services.

- **PeerPub Initialization**: Sets up a Peer Publisher to broadcast messages to all subscribers. This is used to publish updates about order matches, additions, and updates.

- **Broadcast Announcements**: Announces the `order_updates` topic, under which order-related updates are published to subscribers.

### Order Management

- **Order Model Import**: Imports the `Order` model, which defines the structure of an order including its price, quantity, type, and owner.

- **Order Management Functions**: Includes functions to emit events (`emitAddOrder`, `emitDeleteOrder`, etc.) and synchronize orders across instances. These functions leverage RxJS to handle event streams and state changes reactively.

### Subscription to Order Updates

- **PeerSub Initialization**: Initializes a Peer Subscriber to listen for broadcast messages on the `order_updates` topic. This ensures the server is aware of and can react to updates from other instances in the network.

- **Delayed Subscription**: Uses `setTimeout` to delay subscription to the `order_updates` topic. This workaround ensures that the subscription only attempts after the network is likely ready, reducing the chance of initial errors when the service starts.

### Broadcasting Updates

- **Message Broadcasting**: Utilizes the `PeerPub` instance to broadcast order updates. It serializes message data into JSON format before publishing.

### Subscription and Message Processing

- **Message Stream Processing**: Converts PeerSub messages into an Observable stream, filtering and processing specific message types (`order_added`, `order_updated`, etc.). It ensures that incoming updates are appropriately synchronized with the server's order book.

### Synchronization Functions

- Implements functions to synchronize order additions, updates, and removals based on messages received from the network. This maintains consistency across all instances of the order book.

## Client.js

### Initialization and Configuration

- **Grenache Link Setup**: Initializes the connection to the Grape DHT network, enabling the client to communicate within the distributed system.

- **PeerRPCClient Initialization**: Sets up a Grenache Peer RPC Client, which allows the client to send requests to the server, such as placing or deleting orders.

- **PeerSub Initialization**: Prepares a Peer Subscriber to listen for broadcast messages, specifically for updates related to orders. This ensures the client remains informed about changes within the exchange, like new orders, order matches, or updates.

### Subscription to Order Updates

- **Order Update Subscription**: The client subscribes to the `order_updates` topic to receive real-time updates about order matches, additions, and updates, keeping the local view of the market current.

### Handling Incoming Messages

- **Message Processing**: Upon receiving messages, the client parses and logs them. Although the current implementation primarily logs the received data for demonstration, in a real-world scenario, this could be extended to include more complex client-side logic, such as updating a local order book or UI in response to these events.

### Order Management

- **Order Creation and Management**: Demonstrates how a client can generate and submit orders to the exchange. It includes creating orders with randomized parameters for testing purposes.

- **Observable Order Requests**: Utilizes RxJS to create observables for order requests. This approach allows for elegant handling of asynchronous operations, including retries in case of errors.

### Communication with the Server

- **Sending Requests**: Showcases sending requests to the server to add or delete orders, demonstrating the interaction between client and server in the distributed system.

- **Error Handling and Retries**: Implements error handling for request observables, including a retry strategy. This ensures the client can gracefully handle failures and attempt to resend requests as necessary.

## OrderManagement.js

### Red-Black Tree for Order Book Management

- Utilizes a Red-Black Tree data structure to efficiently manage the order book. This choice provides a balanced tree structure, ensuring operations like insertion, deletion, and search are performed in logarithmic time complexity. There are separate trees for buy and sell orders to facilitate quick matching and updates.

### RxJS for Asynchronous Stream Management

- Employs RxJS to handle asynchronous data streams, which is crucial for managing the flow of order operations (additions, deletions, updates) and ensuring that actions are processed in a timely and orderly fashion.

### Order Matching Logic

- Implements a simple yet effective matching engine that processes new orders against existing orders in the opposite book (buy vs. sell). It supports partial and full matches and updates the order book accordingly.

### Event Broadcasting

- Uses Grenache's PeerPub to broadcast order updates (additions, matches, updates) to all interested parties in the distributed system. This mechanism ensures that all nodes can maintain a synchronized view of the market.

### Synchronization with Other Instances

- Introduces functions like `synchronizeAddOrder`, `synchronizeUpdateOrder`, and `synchronizeRemoveOrder` to handle incoming updates from other instances. This is crucial for keeping the order book consistent across the distributed network.

### Observable Streams for Order Operations

- Merges various sources of order operations into a single observable stream, applying buffering and sorting to ensure operations are processed in a consistent order based on timestamps. This approach is key to handling race conditions and ensuring the integrity of the order book in a distributed setting.

### Comprehensive Order Management Functions

- Provides a set of functions to add, update, and delete orders within the order books. It also includes utility functions like `treeToArray` for converting tree structures into arrays, potentially for serialization or logging purposes.

## Order.js

### Key Components of the Order Class

- **Constructor Parameters**: The constructor accepts parameters for `peerId`, `price`, `quantity`, `type`, and `sequenceNumber`. These parameters are essential for order sorting, matching, and identification within the system.
  - `peerId` serves as an identifier for the client submitting the order, enabling traceability and accountability.
  - `price` and `quantity` represent the trade's price point and amount, respectively, crucial for matching orders.
  - `type` indicates whether the order is a buy or sell, determining its placement within the buy or sell order book.
  - `sequenceNumber` is used for ordering purposes, especially relevant when orders are timestamped identically.

- **Timestamp**: Upon instantiation, each order is timestamped. This timestamp is vital for determining the order's placement within the order book and resolving conflicts or ambiguities in order execution sequence.

- **Unique Order ID Generation**: The `generateOrderId` method combines `peerId`, the timestamp (stripped of non-numeric characters for simplicity), and `sequenceNumber` to generate a unique identifier for the order. This ID is essential for tracking, updating, or cancelling orders as they move through the system.

### Importance in the Distributed Exchange System

- **Order Tracking and Management**: The unique order ID and structured format allow for efficient order tracking, updates, and removal across the distributed system, ensuring that each order's lifecycle is accurately managed.
- **Facilitates Order Matching**: The clear definition of order properties such as type, price, and quantity enables the matching engine (implemented elsewhere in the system) to effectively pair buy and sell orders based on the exchange's matching criteria.
- **Inter-node Communication**: As orders are broadcasted or received from other nodes within the system, the `Order` model provides a standardized format for inter-node communication, ensuring consistency and reliability in distributed order management.

## Limitations and Improvements

Let's discuss the limitations and potential improvements for each of the key files in your distributed exchange system, focusing on `server.js`, `client.js`, `ordermanagement.js`, and `order.js`.

### server.js Limitations and Improvements

#### Limitations:
- **PeerSub Initialization**: The current setup may encounter issues if `peerSub.sub()` is called before any peer announces the topic, leading to errors. This necessitates a delayed subscription, which is not ideal for dynamic systems.
- **Error Handling**: The error handling, especially around PeerSub's subscription failures, is not robust, potentially causing unhandled exceptions.
- **Scalability**: As the network grows, broadcasting every update might not be scalable due to increased network traffic and processing overhead.

#### Improvements:
- **Dynamic Subscription Handling**: Implement a more dynamic way to handle subscriptions, such as retry mechanisms or checking for topic availability before attempting to subscribe.
- **Advanced Error Handling**: Improve error handling by implementing comprehensive try-catch blocks and more nuanced reactions to different types of errors.
- **Efficient Broadcasting**: Adopt more efficient data distribution mechanisms, such as delta encoding for updates or partitioned topics to reduce unnecessary data transmission.

### client.js Limitations and Improvements

#### Limitations:
- **Order Synchronization**: The client receives updates but does not contribute to or directly manipulate the distributed order book, which could be seen as a missed opportunity for decentralization.
- **Error Recovery**: The client's error recovery strategies, particularly around order submission retries, could be more sophisticated.

#### Improvements:
- **Client-Side Order Book**: Implement a client-side order book that can be updated with broadcast messages, allowing for more informed trading decisions without querying the server.
- **Enhanced Recovery Strategies**: Develop more advanced error recovery strategies, such as exponential backoff for retries, to better handle transient network issues.

### ordermanagement.js Limitations and Improvements

#### Limitations:
- **Concurrency Control**: The current implementation does not explicitly handle concurrency, which might lead to race conditions when orders are rapidly added or removed.
- **Performance Bottlenecks**: The use of red-black trees for order management is efficient for ordered operations but could become a bottleneck with a very high volume of orders due to the necessity of tree rebalancing.

#### Improvements:
- **Concurrency Mechanisms**: Introduce concurrency control mechanisms, such as locks or transactional data structures, to ensure data integrity in high-throughput scenarios.
- **Alternative Data Structures**: Evaluate and possibly integrate more performance-optimized data structures or databases tailored to high-frequency trading environments.

### order.js Limitations and Improvements

#### Limitations:
- **Limited Order Properties**: The current `Order` model is basic, potentially lacking in fields that might be necessary for more complex trading strategies or order types.
- **Flexibility**: The model is rigid, making it challenging to extend for different markets or trading instruments without modification.

#### Improvements:
- **Extend Order Model**: Extend the `Order` model to include additional fields such as order expiry, stop loss, take profit levels, or support for different asset types.
- **Modular Design**: Refactor the `Order` class into a more modular design, allowing for easy extension or customization for different trading scenarios or instruments.

### Across All Components

#### Limitations:
- **Testing and Fault Tolerance**: There is limited discussion on testing strategies and fault tolerance measures, which are critical for financial systems.
- **Security Considerations**: Security, particularly around message integrity and authentication between nodes, is not explicitly addressed.

#### Improvements:
- **Comprehensive Testing**: Implement comprehensive unit and integration testing, including stress tests to evaluate the system under load.
- **Enhanced Security Measures**: Integrate security measures such as message signing, encryption, and authentication mechanisms to protect against malicious activities.

These improvements aim to address current limitations and prepare the system for scalability, reliability, and efficiency enhancements beyond the MVP stage.    

## Conclusion

This distributed exchange system prototype showcases the potential for building scalable, real-time trading platforms using peer-to-peer technology. Future enhancements will focus on robustness, security, and scalability to prepare the system for real-world deployment.
