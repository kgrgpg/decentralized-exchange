## README for Distributed Exchange System

### Overview

This project demonstrates a simplified model of a distributed exchange system built using Node.js and leveraging the Grenache Grape DHT (Distributed Hash Table) for peer-to-peer communication. The system allows multiple clients to submit buy or sell orders, which are processed by servers in a distributed network. The servers match orders, update, and broadcast order events to all clients and other servers, ensuring real-time synchronization across the network.

### Architecture

- **Clients**: Submit buy or sell orders and listen for updates on order status.
- **Servers**: Process orders, match them as possible, and broadcast updates.
- **Grenache Grape DHT**: Facilitates peer-to-peer communication between clients and servers.

### Components

1. **Client.js**: A client script that submits orders and listens for updates.
2. **Server.js**: A server script that processes orders, matches them, and broadcasts updates.
3. **SecondaryServer.js**: This script serves as a temporary measure to simulate an additional server in the network, facilitating server-to-server communication and order synchronization. It was specifically designed to be plugged into an already running network consisting of a primary server and multiple clients, without the need to halt or restart the existing setup. The goal was to test and demonstrate the dynamic scalability of the system - allowing new server nodes to join and synchronize with the network seamlessly. The code within SecondaryServer.js mirrors the primary server's functionalities, including processing orders, matching them, and broadcasting updates. However, it also subscribes to updates from other servers to maintain a synchronized state across the network. This approach ensures that all nodes, both servers, and clients, have a consistent view of the order book, thereby enhancing the reliability and robustness of the distributed exchange system. Once the server-to-server communication and synchronization are thoroughly tested and validated, the intention is to merge the functionalities of SecondaryServer.js back into server.js, consolidating the codebase for simplicity and maintainability.
4. **Order.js**: This script defines a simple yet effective model for orders within our distributed exchange system. Each order is characterized by essential attributes such as peerId, price, quantity, type (buy or sell), and sequenceNumber, providing a comprehensive framework for order representation.
*     UUID Generation: A unique identifier (UUID) for each order is crucial for distinguishing and tracking orders throughout their lifecycle in the distributed system. In our implementation, the UUID is generated using a combination of the peerId, a timestamp (to ensure time-based uniqueness), and the sequenceNumber (to preserve the order of operations). This method ensures that each order can be uniquely identified across the network, mitigating the risk of collisions and enabling precise order matching and management. The format order_{peerId}_{timestamp}_{sequenceNumber} leverages both temporal and operational elements, offering a robust mechanism for order identification. This UUID approach facilitates the tracking, updating, and deletion of orders in a performant and reliable manner, supporting the system's overall efficiency and integrity.
6. **OrderManagement.js**: Contains the logic for managing and matching orders using red-black trees for efficient order book management.

### Technologies Used

- **Node.js**: For the runtime environment.
- **Grenache Grape**: A lightweight DHT framework for building scalable, distributed applications.
- **RxJS** stands for Reactive Extensions for JavaScript, a library for composing asynchronous and event-based programs using observable sequences. It provides powerful utilities to work with asynchronous data streams, enabling complex operations like data transformation, filtering, aggregation, and more, with less code and increased readability. In our distributed exchange system, RxJS plays a pivotal role in several areas to manage the flow of data and events efficiently. Here's how RxJS is utilized across different parts of our code:

#### Inside Client.js:

1. **Order Request Handling**: In `client.js`, RxJS observables are employed to manage the lifecycle of order requests. The creation of order requests is wrapped in observables, allowing us to handle asynchronous operations, such as sending an order to the server, with ease. The `interval` function is used to periodically generate order requests, simulating real-world trading activity.

2. **Retrying Failed Requests**: The `retryWhen` operator allows the system to automatically retry failed requests after a specified delay, improving the robustness of the client in the face of transient network failures or server unavailability.

3. **Error Handling and Stream Finalization**: Operators like `catchError` and `finalize` are used to gracefully handle errors that occur during the order request process and to perform cleanup actions when the observable stream completes or errors out.

#### Inside Server.js:

1. **Order Processing**: RxJS is not directly utilized in the server scripts for order processing; however, the asynchronous nature of the server's request handling could be enhanced with RxJS to manage incoming order requests and responses more effectively, particularly if integrating more complex logic or external asynchronous data sources in the future.

#### Inside Ordermanagement.js:

1. **Order Matching and Event Broadcasting**: While the core logic for order matching and event broadcasting in `ordermanagement.js` doesn't directly utilize RxJS, the library could be integrated to manage the streams of order events more reactively. For example, using subjects (`Subject`, `BehaviorSubject`) to emit and subscribe to order events, such as order additions, deletions, and matches, could streamline the communication between components and improve the system's reactivity to state changes.

#### General Utilization:

- **Data Transformation and Filtering**: Throughout the system, RxJS can be leveraged to transform and filter data streams as they pass through the application. This is particularly useful for processing order data, applying business logic, and ensuring that subscribers react only to relevant changes.

- **Combining Streams**: The `merge` and `combineLatest` operators can be utilized to combine multiple streams of data, such as incoming orders and market data, into a single stream that can be processed uniformly. This could enhance the system's ability to react to complex state changes that depend on multiple sources of data.

- **Stream Buffers and Time Windows**: Operators like `bufferTime` or `windowTime` can be used to aggregate events over specified time intervals, useful for batching order processing or summarizing market data over time.

In summary, RxJS offers a versatile set of tools that can significantly enhance the handling of asynchronous events and data streams in a distributed exchange system. Its application can lead to more efficient, readable, and maintainable code, particularly in scenarios involving complex event processing, asynchronous data handling, and reactive state management.
- **Red-Black Tree**: For efficient order book management.

### Workflow

1. **Order Submission**: Clients submit buy or sell orders through `PeerRPCClient`.
2. **Order Processing**: Servers receive orders, match them using an internal order book managed with red-black trees, and process them accordingly.
3. **Event Broadcasting**: Upon order matching, updating, or adding, servers broadcast these events to all clients and other servers using `PeerPub`.
4. **Event Listening**: Clients and secondary servers listen for updates using `PeerSub` and update their state based on the received messages.

### Future Implementations

- **Resilience and Fault Tolerance**: Implement mechanisms to handle server failures and ensure the system can recover from partial outages.
- **Load Balancing**: Develop strategies to distribute client connections and processing load across multiple servers.
- **Security Enhancements**: Secure communication channels and implement authentication to protect sensitive data.
- **Data Consistency**: Introduce versioning for orders and implement conflict resolution mechanisms to handle discrepancies.

### Running the Project

1. **Setup Grenache Grape**: Ensure you have at least two instances of Grenache Grape running and interconnected.
2. **Start Server(s)**: Run `node server.js` 
3. **Run Client(s)**: Execute `node client.js` to start a client instance. Multiple clients can be started to simulate real-world usage.

### Conclusion

This distributed exchange system prototype showcases the potential for building scalable, real-time trading platforms using peer-to-peer technology. Future enhancements will focus on robustness, security, and scalability to prepare the system for real-world deployment.