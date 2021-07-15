const { google } = require('googleapis');

const credentials = require('./credentials.json')

const scopes = [
    'https://www.googleapis.com/auth/drive'
];

const fileTypes = ['image/jpeg', 'image/png']
const folderTypes = ['application/vnd.google-apps.folder']
  
const listDriveContents = async()=>{

    const auth = new google.auth.JWT(
        credentials.client_email, null,
        credentials.private_key, scopes
    );
    
    const drive = google.drive({ version: "v3", auth });
    
    const results = await drive.files.list({
        fields : '*'
    });
    
    const nodes = results.data.files;
    
    return nodes

}

module.exports = listDriveContents