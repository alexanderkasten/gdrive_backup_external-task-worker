const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');

const {HttpClient} = require('@essential-projects/http');
const {
  ExternalTaskApiClientService,
  ExternalTaskApiExternalAccessor,
  ExternalTaskWorker,
} = require('@process-engine/external_task_api_client');

const {ExternalTaskFinished} = require('@process-engine/external_task_api_contracts');

const identity = {
  token: 'ZHVtbXlfdG9rZW4=',
};

const TOPIC = 'UPLOAD_BACKUP';
const MAX_TASKS = 10;
const POLLING_TIMEOUT = 1000;

let scriptOutput = "";

async function execCommand(command) {
  return new Promise((resolve, reject) => {
    const childProcess = exec(command, (err, stdin, stderr) => {
      if (err || stderr) {
        reject(err, stderr);
      }

      return resolve(stdin);
    });

    childProcess.stdout.on('data', (data) => {
      console.log(data);
      scriptOutput+= data;
    });
  
    childProcess.stderr.on('data', (data) => {
      console.log(data);
      scriptOutput+= data;

    });
  });
}

function createExternalTaskWorker(url) {
  const httpClient = new HttpClient();
  httpClient.config = {url: url};
  
  const externalAccessor = new ExternalTaskApiExternalAccessor(httpClient);
  const externalTaskAPIService = new ExternalTaskApiClientService(externalAccessor);
  const externalTaskWorker = new ExternalTaskWorker(externalTaskAPIService);

  return externalTaskWorker;
}

async function uploadBackupToGDrive(payload) {
  const backupFolderPath = path.join(__dirname, '..', 'cloud_backups');
  const files = fs.readdirSync(backupFolderPath, {encoding: 'utf8'});

  for (const file of files) {
    scriptOutput += `copy ${backupFolderPath}/${file} to google drive`;
    try {
      await execCommand(`cp -f ${backupFolderPath}/${file} ~/drive/server_backups`);
    } catch (error) {
      console.error(error)
      scriptOutput += `copy operation failed for ${backupFolderPath}/${file}`;
      scriptOutput += error;
    }
  }

  const result = { 
    output: scriptOutput
  };

  console.log('Done!');

  return result;
};

async function main() {
  const externalTaskWorker = createExternalTaskWorker('https://pe.kasten.pw');

  console.log(`Waiting for tasks with topic '${TOPIC}'.`);

  externalTaskWorker.waitForAndHandle(identity, TOPIC, MAX_TASKS, POLLING_TIMEOUT, async (externalTask) => {
    console.log('ExternalTask data: ');
    console.log(externalTask);
    console.log('');

    const result = await uploadBackupToGDrive(externalTask.payload);
    const externalTaskFinished = new ExternalTaskFinished(externalTask.id, result);

    return externalTaskFinished;
  }); 
}

main();
