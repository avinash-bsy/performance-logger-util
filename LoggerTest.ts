import * as seq from 'seq-logging';
import { Logger, LogFunction } from "@itwin/core-bentley";
import { ClashRestClient } from "@bentley/clash-detection-rest-client";

const logger = new seq.Logger({
  serverUrl: 'http://localhost:5341', // Replace with your Seq server URL
  apiKey: 'fsDiaNo5WXyODzRxG3wm', // Replace with your Seq API key
  onError: (e: Error) => {
    console.log(e);
  }
});

const Category = "ClashDetection:RestClient";

const logError: LogFunction = (category: string, message: string) => {
  logger.emit({
      timestamp: new Date(),
      level: 'Error',
      messageTemplate: message,
      properties: {
        Name: 'Alice',
        Category: category,
      },
  })
}

const logInfo: LogFunction = (category: string, message: string) => {
  logger.emit({
      timestamp: new Date(),
      level: 'Information',
      messageTemplate: message,
      properties: {
        Name: 'Alice',
        Category: category,
      },
  })
}

const logWarning: LogFunction = (category: string, message: string) => {
  logger.emit({
      timestamp: new Date(),
      level: 'Warning',
      messageTemplate: message,
      properties: {
        Name: 'Alice',
        Category: category,
      },
  })
}

const logTrace: LogFunction = (category: string, message: string) => {
  logger.emit({
      timestamp: new Date(),
      level: 'Error',
      messageTemplate: message,
      properties: {
        Name: 'Alice',
        Category: category,
      },
  })
}

Logger.initialize(logError, logWarning, logInfo, logTrace);
Logger.setLevel(Category, 1);

Logger.logInfo(Category, "This is info!");
Logger.logError(Category, "This is error!");
Logger.logWarning(Category, "This is warning!");
Logger.logTrace(Category, "This is trace!");