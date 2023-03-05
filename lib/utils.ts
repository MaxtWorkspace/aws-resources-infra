/* eslint-disable @typescript-eslint/ban-types */
import { CognitoIdentityProviderClient, DescribeUserPoolDomainCommand, SetUICustomizationCommand } from '@aws-sdk/client-cognito-identity-provider';
import { ChangeResourceRecordSetsCommand, ListResourceRecordSetsCommand, type ResourceRecordSet, type Route53Client } from '@aws-sdk/client-route-53';
import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';

export type Validator = () => boolean;
export type AsyncFunc = () => Promise<void>;
export type AsyncValidator = () => Promise<boolean>;

export function loadFileSync(path: string) {
  return readFileSync(path, 'utf-8');
}

export async function loadFile(path: string) {
  return await readFile(path, 'utf-8');
}

export async function loadImage(path: string) {
  const content = await readFile(path);
  return new Uint8Array(content as ArrayBuffer);
}

// Poll until fn it resolves to true or poll times out
export async function poll(fn: AsyncValidator, pollIntervial: number, pollTimeOut: number) {
  const endTime = Date.now() + pollTimeOut;
  let lastTimeOut: NodeJS.Timeout;
  const validate = (resolve: Function, reject: Function) => {
    const time = Date.now();
    Promise.resolve(fn())
      .then((result) => {
        if (result) {
          clearTimeout(lastTimeOut);
          resolve();
        } else if (time < endTime) {
          lastTimeOut = setTimeout(validate, pollIntervial, resolve, reject);
        } else {
          reject(new Error('Polling time out! Try Again!'));
        }
      })
      .catch((err) => reject(err));
  };
  return new Promise(validate);
}

// Poll until fn resolves or poll times out
export async function pollUntilDone(fn: AsyncFunc, pollIntervial: number, pollTimeOut: number) {
  const endTime = Date.now() + pollTimeOut;
  let done = false;
  let lastTimeOut: NodeJS.Timeout;
  Promise.resolve(fn())
    .then(() => {
      done = true;
    })
    .catch((err) => {
      throw err;
    });
  // resolves only when fn resolves or time out
  const validate = (resolve: Function, reject: Function) => {
    const time = Date.now();
    if (done) {
      clearTimeout(lastTimeOut);
      resolve();
    } else if (time < endTime) {
      lastTimeOut = setTimeout(validate, pollIntervial, resolve, reject);
    } else {
      reject(new Error('Polling time out! Try Again!'));
    }
  };
  return new Promise(validate);
}

// Poll until fn it resolves to true or poll times out
export async function pollWithPrerequisites(prereqs: AsyncFunc[], fn: AsyncValidator, pollIntervial: number, pollTimeOut: number) {
  const endTime = Date.now() + pollTimeOut;
  let preReqDone = false;
  let lastTimeOut: NodeJS.Timeout;
  // set preReqs done when all of them are done
  Promise.all(prereqs.map((pre) => pre()))
    .then(() => {
      preReqDone = true;
    })
    .catch((err) => {
      throw err;
    });
  const validate = (resolve: Function, reject: Function) => {
    const time = Date.now();
    // if prerequisites not done, schedule the next call until time out
    if (!preReqDone) {
      if (time < endTime) {
        lastTimeOut = setTimeout(validate, pollIntervial, resolve, reject);
      } else {
        reject(new Error('Polling time out! Try Again!'));
      }
    }

    // resolves only when fn resolves to true
    Promise.resolve(fn())
      .then((result) => {
        if (result) {
          clearTimeout(lastTimeOut);
          resolve();
        } else if (time < endTime) {
          lastTimeOut = setTimeout(validate, pollIntervial, resolve, reject);
        } else {
          reject(new Error('Polling time out! Try Again!'));
        }
      })
      .catch((err) => reject(err));
  };
  return new Promise(validate);
}

export async function getRecords(client: Route53Client, zoneId: string, recordName: string) {
  const command = new ListResourceRecordSetsCommand({
    HostedZoneId: zoneId,
    StartRecordName: recordName,
    MaxItems: 50,
  });
  const response = await client.send(command);
  return response.ResourceRecordSets?.filter((r) => r.Name === `${recordName}.` && r.Type === 'CNAME') || [];
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
  const response = await client.send(command);
  return response;
}

export async function setUserPoolUICustomization(client: CognitoIdentityProviderClient, css: string, logo: Uint8Array, userPoolId?: string, clientId?: string) {
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
