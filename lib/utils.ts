/* eslint-disable @typescript-eslint/no-explicit-any */
import { CognitoIdentityProviderClient, DescribeUserPoolDomainCommand, SetUICustomizationCommand } from '@aws-sdk/client-cognito-identity-provider';
import {ChangeResourceRecordSetsCommand, ListResourceRecordSetsCommand, type ResourceRecordSet, type Route53Client} from '@aws-sdk/client-route-53';
import { readFile } from 'fs/promises';

export type Validator = () => boolean;
export type AsyncFunc = () => Promise<void>;
export type AsyncValidator = () => Promise<boolean>;

export async function loadFile(path: string) {
  return await readFile(path, 'utf-8');
}

export async function loadImage(path: string) {
  const content = await readFile(path);
  return new Uint8Array(content as ArrayBuffer);
}

export async function poll(fn: AsyncValidator, pollIntervial: number, pollTimeOut: number) {
  const endTime = Date.now() + pollTimeOut;
  const validate = async () => {
    const isValid = await fn();
    const time = Date.now();
    if (time > endTime) {
      throw new Error('Polling time out! Try Again!');
    } else if (!isValid) {
      setTimeout(validate, pollIntervial);
    }
  };
  return validate();
}

export async function pollWithPrerequisites(prereqs: AsyncFunc[], fn: AsyncValidator, pollIntervial: number, pollTimeOut: number) {
  const endTime = Date.now() + pollTimeOut;
  await Promise.all(prereqs.map(pre => pre()));
  const validate = async () => {
    const isValid = await fn();
    const time = Date.now();
    if (time > endTime) {
      throw new Error('Polling time out! Try Again!');
    } else if (!isValid) {
      setTimeout(validate, pollIntervial);
    }
  };
  return validate();
}

export async function getRecords(client: Route53Client, zoneId: string, recordName: string) {
  const command = new ListResourceRecordSetsCommand({
    HostedZoneId: zoneId,
    StartRecordName: recordName,
    MaxItems: 50,
  });
  const response = await client.send(command);
  return response.ResourceRecordSets?.filter(r => r.Name === `${recordName}.` && r.Type === 'CNAME') || [];
}

export async function sendChangeRecord(client: Route53Client, zoneId: string, action: string, comment: string, record: ResourceRecordSet) {
  const command = new ChangeResourceRecordSetsCommand({
    HostedZoneId: zoneId,
    ChangeBatch: {
      Comment: comment,
      Changes: [
        {
          Action: action,
          ResourceRecordSet: record,
        },
      ],
    },
  });
  return client.send(command);
}

export async function getCognitoDomainDescribe(client: CognitoIdentityProviderClient, domainName: string) {
  const command = new DescribeUserPoolDomainCommand({
    Domain: domainName,
  });
  return await client.send(command);
}

export async function setUserPoolUICustomization(client: CognitoIdentityProviderClient, css: string, logo: Uint8Array, userPoolId?: string, clientId?: string,) {
  if (!userPoolId || !clientId) {
    throw new Error();
  }

  const command = new SetUICustomizationCommand({
    UserPoolId: userPoolId,
    ClientId: clientId,
    CSS: css,
    ImageFile: logo,
  });

  return await client.send(command);
}
