const googleDrivePlugin = require("./.instantcode/plugins/google-drive");

const main = async ()=>{

  let config = {
    "data" : {
      drive : []
    },
    "fileTemplates" : [
      {
        "src" : "./.instantcode/files/code.js",
        "dest" : "./src/product/pages/CategoryList.svelte"
      },
      // You can use an additional "if" key and provide a function that will return either true or false.
      // Returning false will prevent a file for being generated. Your function will receive the data input for the template.
      // {
      //   "src" : "./.instantcode/files/module.js",
      //   "dest" : "./src/[id]/[id].module.js",
      //   "key" : "model",
      //   "if" : (model)=>{
      //     return model.code
      //   }
      // }
    ]
  }

  config.data.drive = await googleDrivePlugin()
  return config

}

module.exports = main()