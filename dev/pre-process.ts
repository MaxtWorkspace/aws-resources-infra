/* eslint-disable @typescript-eslint/no-empty-function */
import {Route53Client} from '@aws-sdk/client-route-53';
import {config} from '../lib/config';
import {getRecords, pollWithPrerequisites, sendChangeRecord} from '../lib/utils';
import * as winston from 'winston';

const logger = winston.loggers.get('sdk-logger').child({service: 'Route53'});
logger.debug('Pre-process - Delete existing Route53 alias CNAME record for cognito user pool domain');

const client = new Route53Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

try {
  pollWithPrerequisites([deleteExistingCognitoAliasRecord], verifyDeleted, config.polling.checkInterval * 1000, config.polling.timeOut * 1000);
} catch (err) {
  logger.error(err);
  throw err;
}

async function deleteExistingCognitoAliasRecord() {
  // Verify there is an alias record to delete
  const records = await getRecords(client, config.domain.hostedZoneId, config.domain.domainName);

  if (records.length > 1) {
    throw new Error(`Invalid Records - more that one record is found under domain: ${config.domain.domainName}`);
  }

  if (records.length === 0) {
    logger.info(`Record already DELETED - found 0 record under domain: ${config.domain.domainName}`);
    return;
  }

  // Delete the alias record
  await sendChangeRecord(client, config.domain.hostedZoneId, 'DELETE', 'Delete the cognito domain alias CNAME record before CDK Deploy', records[0]);
}

async function verifyDeleted() {
  const records = await getRecords(client, config.domain.hostedZoneId, config.domain.domainName);

  if (records.length > 1) {
    throw new Error(`Invalid Records - more that one record is found under domain: ${config.domain.domainName}`);
  }

  if (records.length === 0) {
    logger.info('Record DELETED Successfully - existing cognito domain alias recod is deleted');
    return true;
  }

  return false;
}
