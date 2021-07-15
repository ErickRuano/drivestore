const driveContentsMapper = (driveContents)=>{
    return driveContents.map(node => { return { id : node.id, picture : node.webContentLink } });
}

module.exports = driveContentsMapper