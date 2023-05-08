import { Message, MessageType, SubscribeMessage, UnsubscribeMessage } from '../../message/types'
import { MessageProcessor, MessageProcessorOptions } from './types'

import { Client } from '../../common/server/clientStore/types'
import { StoreServerReporter } from '../reporter/types'
import { TopicStore } from '../topicStore/types'
import { sortMessagesByType } from '../../message'

const processSubscribeMessage = (
  msg: SubscribeMessage,
  senderClient: Client,
  topicStore: TopicStore,
  reporter?: StoreServerReporter,
) => {
  const topicNames = Array.isArray(msg.data.topics) ? msg.data.topics : [msg.data.topics]
  topicNames.forEach(topicName => {
    topicStore.subscribeClientToTopic(senderClient, topicName)
    reporter?.onClientSubscribeTopic?.(senderClient, topicStore.getTopic(topicName))
  })
}

const processUnsubscribeMessage = (
  msg: UnsubscribeMessage,
  senderClient: Client,
  topicStore: TopicStore,
  reporter?: StoreServerReporter,
) => {
  const topicNames = Array.isArray(msg.data.topics) ? msg.data.topics : [msg.data.topics]
  topicNames.forEach(topicName => {
    const wasSubscribed = topicStore.unsubscribeClientFromTopic(senderClient.uuid, topicName)
    if (wasSubscribed)
      reporter?.onClientUnsubscribeTopic?.(senderClient, topicStore.getTopic(topicName))
  })
}

const processMsg = (msg: Message, senderClient: Client, topicStore: TopicStore, reporter?: StoreServerReporter): void => {
  switch (msg.type) {
    case MessageType.SUBSCRIBE: {
      processSubscribeMessage(msg, senderClient, topicStore, reporter)
      break
    }
    case MessageType.UNSUBSCRIBE: {
      processUnsubscribeMessage(msg, senderClient, topicStore, reporter)
      break
    }
    case MessageType.ACTION: {
      topicStore.digest(msg)
      break
    }
    default:
      break
  }
}

const processMsgList = (msgs: Message[], senderClient: Client, topicStore: TopicStore, reporter?: StoreServerReporter): void => {
  const messagesByType = sortMessagesByType(msgs)
  messagesByType.subscribe.forEach(msg => processSubscribeMessage(msg, senderClient, topicStore, reporter))
  messagesByType.unsubscribe.forEach(msg => processUnsubscribeMessage(msg, senderClient, topicStore, reporter))
  topicStore.digest(messagesByType.action)
}

export const createMessageProcessor = (
  options: MessageProcessorOptions,
): MessageProcessor => ({
  process: (msgs, senderClient) => {
    if (Array.isArray(msgs))
      processMsgList(msgs, senderClient, options.topicStore, options.reporter)
    else
      processMsg(msgs, senderClient, options.topicStore, options.reporter)
  },
})