const { google } = require('googleapis');
const fs = require('fs')

const credentials = require('./credentials.json')

const scopes = [
    'https://www.googleapis.com/auth/drive'
];


const fileTypes = ['image/jpeg', 'image/png']
const folderTypes = ['application/vnd.google-apps.folder']

const insertChildren = (nodes, node, parent)=>{
    nodes.forEach(n =>{
        if(n.id === parent){
            console.log('found parent')
            if(n.children && Array.isArray(n.children)){
                n.children.push(node)
            }else{
                n.children = [ node ]
            }
            console.log(n)
        }
    })
}

const createTree = (nodes, types) =>{
    nodes.forEach((node, i) => {
        if(node.parents && types.includes(node.mimeType)){
            node.parents.forEach( parent =>{
                insertChildren(nodes, node, parent)
            } )
        }
        nodes.splice(i, 1)
    })
    fs.writeFileSync('output.json', JSON.stringify(nodes, null, 2))
}

  
const main = async()=>{

    const auth = new google.auth.JWT(
        credentials.client_email, null,
        credentials.private_key, scopes
    );
    
    const drive = google.drive({ version: "v3", auth });
    
    const results = await drive.files.list({
        fields : '*'
    });
    
    const nodes = results.data.files;
    

    if (nodes.length) {
        createTree(nodes, fileTypes)
        // createTree(nodes, folderTypes)
        
    } else {
        console.log('No files found');
    }


}

 main()