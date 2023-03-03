
import {CognitoIdentityProviderClient} from '@aws-sdk/client-cognito-identity-provider';
import {Route53Client, type ResourceRecordSet} from '@aws-sdk/client-route-53';
import {config} from '../lib/config';
import {getCognitoDomainDescribe, getRecords, loadFile, loadImage, pollWithPrerequisites, sendChangeRecord, setUserPoolUICustomization} from '../lib/utils';
import * as winston from 'winston';

const logger = winston.loggers.get('sdk-logger').child({service: 'Route53, Cognito Identity Provider'});
logger.debug('Post-process - Create Route53 alias CNAME record for cognito user pool domain');

const clientCognito = new CognitoIdentityProviderClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const clientRoute53 = new Route53Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

try {
  // Either UploadHostedUICustomization or CreateCognitoAliasRecord fails, the verifyCreated is not called, so will also fail record creation check
  pollWithPrerequisites([UploadHostedUICustomization, CreateCognitoAliasRecord], verifyCreated, config.polling.checkInterval * 1000, config.polling.timeOut * 1000);
} catch (err) {
  logger.error(err);
  throw err;
}

async function CreateCognitoAliasRecord() {
  const records = await getRecords(clientRoute53, config.domain.hostedZoneId, config.domain.domainName);
  if (records.length > 0) {
    logger.warn(`Existing Alias Record - found an existing cognito domain alias record for domain: ${config.domain.domainName}, please verify that the record matches with the alias target in the user pool: ${config.userPool}`);
    return;
  }

  const response = await getCognitoDomainDescribe(clientCognito, config.domain.domainName);
  const alias = response.DomainDescription?.CloudFrontDistribution;
  const record: ResourceRecordSet = {
    Name: config.domain.domainName,
    SetIdentifier: config.cognitoDomainIdentifier,
    Region: config.aws.region,
    Type: 'CNAME',
    TTL: 300,
    ResourceRecords: [
      { Value: alias },
    ],
  };

  logger.info(`Creating record for alias: ${alias}`, { AliasRecord: record });
  await sendChangeRecord(clientRoute53, config.domain.hostedZoneId, 'CREATE', 'Create the cognito domain alias CNAME record before CDK Deploy', record);
}

async function verifyCreated() {
  const records = await getRecords(clientRoute53, config.domain.hostedZoneId, config.domain.domainName);
  if (records.length > 1) {
    throw new Error(`Invalid Records - more that one record is found under domain: ${config.domain.domainName}, there should only be one alias record for cognito user pool`);
  }

  if (records.length === 1) {
    logger.info('Record CREATED Successfully - existing cognito domain alias recod is created');
    return true;
  }

  return false;
}

async function UploadHostedUICustomization() {
  const cognitoDomainResponse = await getCognitoDomainDescribe(clientCognito, config.domain.domainName);
  const userPoolId = cognitoDomainResponse.DomainDescription?.UserPoolId;

  const css = await loadFile('./public/hosted-ui.css');
  const logo = await loadImage('./public/logo-min.png');

  const response = await setUserPoolUICustomization(clientCognito, css, logo, userPoolId, 'ALL');
  const lastModified = response.UICustomization?.LastModifiedDate;
  const returnedCss = response.UICustomization?.CSS;

  if (css != returnedCss) {
    throw new Error('UI Customization failed - uploaded css and returned css mismatch, please manually upload');
  }

  if (!lastModified) {
    logger.warn('Existing UI Customization - css updated, but did not verify image matched with uploaded image(verify manually if desired)');
    return;
  }
  
  const elapsed = Date.now() - lastModified.getDate();
  if (elapsed > 10 * 1000) {
    throw new Error('UI Customization failed - last modified date more than 10 seconds, please manually upload');
  }

  if (elapsed > 1000) {
    logger.warn('UI Customization Might Fail - last modified date more than 1 second, please validate and manually upload');
  }

  logger.warn(`Uploaded Successfully - successfully uploaded css and logo to cognito hosted UI under domain: ${config.domain.domainName}`);
}
