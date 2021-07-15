const listDriveContentsService = require('./listDriveContentsService')
const driveContentsMapper = require('./driveContentsMapper')

const main = async ()=>{
    return  driveContentsMapper(await listDriveContentsService())
}

module.exports = main