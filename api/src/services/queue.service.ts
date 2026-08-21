import ampqlib from 'amqplib';

const { RABBITMQ_HOST = '' } = process.env;

export interface QueueService<T> {
  healthcheck(): Promise<boolean>;
  send(message: T, headers?: any): Promise<boolean>;
  subscribe(callback: Function): Promise<void>;
}

function createQueueService<T>(messageGroup: string): QueueService<T> {
  return new RabbitQueueService(messageGroup);
}

class RabbitQueueService<T> implements QueueService<T> {
  private channel: ampqlib.Channel | null = null;
  private readonly messageGroup: string;

  public constructor(messageGroup: string) {
    this.messageGroup = messageGroup;
  }

  private async connect(ignoreCache: boolean = true): Promise<ampqlib.Channel> {
    let lastError;
    for (let i = 0; i < 10; i++) {
      try {
        return await this._connect(ignoreCache)
      } catch (ex) {
        lastError = ex
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    throw new Error(`could not connect after 10 tries: ${lastError?.message}`)
  }

  private async _connect(ignoreCache: boolean = true): Promise<ampqlib.Channel> {
    if (ignoreCache && this.channel) {
      return this.channel;
    }

    try {
      const connection = await ampqlib.connect(`amqp://${RABBITMQ_HOST}`);
      const channel = await connection.createChannel();
      await channel.assertQueue(this.messageGroup);
      this.channel = channel;
    } catch (ex) {
      await this.handleException(ex);
      throw new Error(`could not connect to queue service: ${ex}`);
    }

    return this.channel;
  }

  public async healthcheck(): Promise<boolean> {
    try {
      const channel = await this.connect(false);
      await channel.assertQueue(this.messageGroup);
      await channel.close();
      return true;
    } catch (ex) {
      await this.handleException(ex);
      return false;
    }
  }

  public async send(message: T, headers?: any): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        const channel = await this.connect();
        const messageSent = channel.sendToQueue(this.messageGroup, Buffer.from(JSON.stringify(message)), { headers });
        resolve(messageSent);
      } catch (ex) {
        this.handleException(ex);
        reject(false);
      }
    });
  }

  public async subscribe(callback: Function): Promise<void> {
    const channel = await this.connect(false);
    const onConsume = async message => {
      if (message) {
        try {
          await callback(message);
          channel.ack(message);
        } catch (ex) {
          this.handleException(ex);
          channel.nack(message);
          throw ex;
        }
      }
    };
    const reconnect = () => setTimeout(() => this.subscribe(callback), 1000);
    channel.on("close", reconnect);
    channel.on("error", reconnect);
    channel.consume(this.messageGroup, onConsume);
  }

  private async handleException(ex: Error): Promise<void> {
    if (ex.message == "Channel closed") {
      this.channel = null;
    }
  }
}

export { createQueueService };
