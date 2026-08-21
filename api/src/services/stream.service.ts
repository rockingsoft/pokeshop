import { Kafka, Consumer } from 'kafkajs'

const { KAFKA_BROKER = '', KAFKA_TOPIC = '', KAFKA_CLIENT_ID = '' } = process.env;

export interface StreamingService<T> {
  subscribe(callback: Function): Promise<void>;
}

function createStreamingService<T>(): StreamingService<T> {
  return new KafkaStreamService(KAFKA_TOPIC);
}

class KafkaStreamService<T> implements StreamingService<T> {
  private client: Kafka | null = null;
  private consumer: Consumer | null = null;
  private readonly topic: string;

  public constructor(topic: string) {
    this.topic = topic;
  }

  private async connect(): Promise<Consumer> {
    if (this.consumer !== null) {
      return this.consumer;
    }

    try {
      this.client = new Kafka({
        clientId: KAFKA_CLIENT_ID,
        brokers: [KAFKA_BROKER]
      });

      await this.waitForTopicCreation();

      this.consumer = this.client.consumer({ groupId: 'test-group' });
      await this.consumer.connect();
    } catch (ex) {
      throw new Error(`could not connect to stream service: ${ex}`);
    }

    return this.consumer;
  }

  public async subscribe(callback: Function): Promise<void> {
    const consumer = await this.connect();

    await consumer.subscribe({ topic: this.topic, fromBeginning: true });

    const { CRASH } = consumer.events;
    await consumer.on(CRASH, () => {
      // make the node process crash on purpose,
      // so we can restart the worker
      process.exit(-1);
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        await callback(message);
      },
    })
  }

  private async waitForTopicCreation() : Promise<void> {
    if (this.client === null) {
      return
    }

    const admin = this.client.admin()
    await admin.connect()

    while (true) {
      const topics = await admin.listTopics()
      
      if (topics.includes(this.topic)) {
        await admin?.disconnect()
        return  
      }

      await sleep(5_000); //wait for 5 seconds
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export { createStreamingService };
