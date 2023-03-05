import { UserPoolOperation } from 'aws-cdk-lib/aws-cognito';
import * as dotenv from 'dotenv';
import * as winston from 'winston';

dotenv.config();

export const config = {
  stackName: 'cognito-lambda-trigger-stack',
  dbName: process.env.DB_NAME || '',
  triggers: [
    { path: './src/', name: 'post-authentication', operation: UserPoolOperation.POST_AUTHENTICATION },
    { path: './src/', name: 'post-confirmation', operation: UserPoolOperation.POST_CONFIRMATION },
  ],
  userPool: {
    userPoolName: process.env.USER_POOL_NAME || '',
    fromEmail: process.env.FROM_EMAIL || '',
    replyToEmail: process.env.REPLY_TO_EMAIL || '',
    callbackUrls: process.env.AUTH_CALL_BACK_URL?.split(',') || [],
  },
  domain: {
    domainName: process.env.DOMAIN_NAME || '',
    certificateArn: process.env.CERTIFICATE_ARN || '',
    hostedZoneId: process.env.HOSTED_ZONE_ID || '',
  },
  aws: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '',
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  polling: {
    checkInterval: 5, // 5 seconds
    timeOut: 1200, // 10 min
  },
  cognitoDomainIdentifier: process.env.COGNITO_DOMAIN_IDENTIFIER,
};

const excludeMeta = ['timestamp', 'label', 'level', 'message', 'stack'];
const metaFormatter = (log: winston.Logform.TransformableInfo) =>
  Object.keys(log)
    .filter((key) => !excludeMeta.includes(key))
    .map((key) => `${key}: ${JSON.stringify(log[key])}`);
const customFormat = winston.format.printf((info) => {
  if (info instanceof Error) {
    return `${info.timestamp} [${info.label}] ${info.level}: ${info.message} ${info.stack} [${metaFormatter(info)}]`;
  }

  return `${info.timestamp} [${info.label}] ${info.level}: ${info.message} [${metaFormatter(info)}]`;
});

winston.loggers.add('cdk-logger', {
  level: 'debug',
  format: winston.format.combine(
    winston.format.label({ label: 'Chaos Lord User Migration CDK Stack' }),
    winston.format.timestamp(),
    winston.format.colorize(),
    customFormat,
  ),
  defaultMeta: { section: 'CDK Stack', folders: './bin & ./lib' },
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: './logs/error.log', level: 'error' })],
});

winston.loggers.add('sdk-logger', {
  level: 'debug',
  format: winston.format.combine(
    winston.format.label({ label: 'Chaos Lord User Migration CDK Stack' }),
    winston.format.timestamp(),
    winston.format.colorize(),
    customFormat,
  ),
  defaultMeta: { section: 'SDK', folders: './dev' },
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: './logs/error.log', level: 'error' })],
});
