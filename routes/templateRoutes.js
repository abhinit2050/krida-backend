const express = require("express");
const bodyParser = require("body-parser");
const templateRouter = express.Router();
const db = require("../config/database");
const multer = require('multer'); 
const { v4: uuidv4 } = require("uuid");
const authMisUser = require("../middlewares/authMW");

// Set up multer storage (store files in memory as buffers)
const storage = multer.memoryStorage(); // Stores files as buffers
const upload = multer({ storage: storage,
fileSize: 1024 * 1024 * 5, // 5 MB file size limit

 });



//add a CMS template
templateRouter.post('/template/add', authMisUser, upload.fields([
    { name: 'backgroundPicture', maxCount: 1 },
    { name: 'backgroundPictureBack', maxCount: 1 }
  ]), (req, res) => {

   console.log("user Type", req.user.USER_TYPE);
    try{

        const {
            templateName,
            summary,
            backGroundColor,
            cardTextColor,
            cardColor,
            hiddenText,
            cardFrontText,
            fontSize,
            fontFamily
        } = req.body;
      
      
        //Access image files (if uploaded)
          const backgroundPicture = req.files['backgroundPicture'] ? req.files['backgroundPicture'][0].buffer : null;
          const backgroundPictureBack = req.files['backgroundPictureBack'] ? req.files['backgroundPictureBack'][0].buffer : null;
          
      
        // Generate a UUID for the id
        const id = uuidv4();
      
        // SQL command to insert data into CMS_TEMPLATE_DETAILS
        const sql = `INSERT INTO CMS_TEMPLATE_DETAILS (
          id, templateName, summary, backGroundColor, cardTextColor, cardColor, hiddenText, cardFrontText, 
          backgroundPicture, backgroundPictureBack, fontSize, fontFamily
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`;
      
      // Execute the SQL command
      db.run(sql, [id, templateName, summary, backGroundColor, cardTextColor, cardColor, hiddenText, cardFrontText, 
            backgroundPicture, backgroundPictureBack, fontSize, fontFamily], function(err) {
          if (err) {
              console.error(err.message);
              return res.status(500).json({ error: "Failed to insert data" });
          }
          res.status(200).json({
              message: "Template added successfully",
              id: id
          });
      });

    }catch(err){
        res.send("Something went wrong ", err);
    }
    
  });
  
  //GET ALL templates
  templateRouter.get('/all/templates', authMisUser, (req, res) => {
    const queryToFetchTemplates = `SELECT * FROM CMS_TEMPLATE_DETAILS`;
  
    db.all(queryToFetchTemplates, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: "Failed to retrieve data" });
        }
        
        for(var i=0;i<rows.length;i++){
          if (rows[i].backgroundPicture) {
            rows[i].backgroundPicture = rows[i].backgroundPicture.toString('base64');
        } else {
            console.warn(`Missing backgroundPicture for row ${i}`);
            rows[i].backgroundpicture = null;
        }
    
        if (rows[i].backgroundPictureBack) {
            rows[i].backgroundPictureBack = rows[i].backgroundPictureBack.toString('base64');
        } else {
            console.warn(`Missing backgroundPictureBack for row ${i}`);
            rows[i].backgroundPictureBack = null;
        }
        }
  
        res.status(200).json({
            message: "Records retrieved successfully",
            data: rows
        });
    });
  });
  
  //GET a specific template based on id
  templateRouter.get('/template/fetch', authMisUser, (req, res) => {
    const { id } = req.query; // Use req.query for query parameters
  
    if (!id) {
        return res.status(400).json({ error: "ID is required" });
    }
  
    const queryTofetchSpecificTemplate = `SELECT * FROM CMS_TEMPLATE_DETAILS WHERE id = ?`;
  
    db.get(queryTofetchSpecificTemplate, [id], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: "Failed to retrieve the record" });
        }
  
        if (!row) {
            return res.status(404).json({ message: "Record not found" });
        }
        if(row.backgroundPicture){
          row.backgroundPicture = (row.backgroundPicture.toString('base64'));
        } else {
          console.warn(`Missing backgroundPicture for the record`);
        }
  
        if(row.backgroundPictureBack){
          row.backgroundPictureBack = (row.backgroundPictureBack.toString('base64'));
        } else {
          console.warn(`Missing backgroundPictureBack for the record`);
        }
        
  
        res.status(200).json({
            message: "Record retrieved successfully",
            data: row
        });
    });
  });
  

  //Modify a particular template
  templateRouter.patch('/template/modify',authMisUser, upload.fields([
    { name: 'backgroundPicture', maxCount: 1 },
    { name: 'backgroundPictureBack', maxCount: 1 }
  ]) ,(req, res) => {
    const { id } = req.query; // Use query parameters to get the id of the record to update
 
  
    if (!id) {
        return res.status(400).json({ error: "ID is required" });
    }
  
    let backgroundPictureValue;
    let backgroundPictureBackValue;
    let cardTextColorValue;
    let cardColorValue;
  
    // Fetch the existing record first
    const selectSql = `SELECT * FROM CMS_TEMPLATE_DETAILS WHERE id = ?`;
  
    db.get(selectSql, [id], (err, existingRecord) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: "Failed to retrieve the record" });
        }
  
        if (!existingRecord) {
            return res.status(404).json({ message: "Record not found" });
        }
  
  
        if(req.files['backgroundPicture'] && req.files['backgroundPictureBack']){
          console.log("picture detected");
            backgroundPictureValue = req.files['backgroundPicture'][0].buffer;
            backgroundPictureBackValue = req.files['backgroundPictureBack'][0].buffer;
            cardTextColorValue = existingRecord.cardTextColor;
            cardColorValue = existingRecord.cardColor;
  
        } else if(req.body.cardTextColor){
          console.log("card text color detected");
          cardTextColorValue = req.body.cardTextColor;
          cardColorValue = req.body.cardColor;
          backgroundPictureValue=req.body.backgroundPicture;
          backgroundPictureBackValue=req.body.backgroundPictureBack;
        }
  
        console.log("values", cardTextColorValue, cardColorValue);
  
        // Prepare updated values: use existing values for columns not provided by the user
        const updatedData = {
          templateName: req.body.templateName || existingRecord.templateName,
          summary: req.body.summary || existingRecord.summary,
          backGroundColor: req.body.backGroundColor || existingRecord.backGroundColor,
          cardTextColor:cardTextColorValue,
          cardColor:cardColorValue,
          hiddenText: req.body.hiddenText || existingRecord.hiddenText,
          cardFrontText: req.body.cardFrontText || existingRecord.cardFrontText,
          backgroundPicture:backgroundPictureValue,
          backgroundPictureBack:backgroundPictureBackValue,
          fontSize: req.body.fontSize || existingRecord.fontSize,
          fontFamily: req.body.fontFamily || existingRecord.fontFamily
      };
  
  
        // SQL for updating the record
        const updateTemplate = `UPDATE CMS_TEMPLATE_DETAILS SET 
        templateName = ?, 
        summary = ?, 
        backGroundColor = ?,
        cardTextColor = ?,
        cardColor=?,
        hiddenText = ?, 
        cardFrontText = ?, 
        backgroundPicture = ?, 
        backgroundPictureBack = ?, 
        fontSize = ?, 
        fontFamily = ?
    WHERE id = ?`;
  
        // Execute the update
        db.run(updateTemplate, [
          updatedData.templateName,
          updatedData.summary,
          updatedData.backGroundColor,
          updatedData.cardTextColor,
          updatedData.cardColor,
          updatedData.hiddenText,
          updatedData.cardFrontText,
          updatedData.backgroundPicture,
          updatedData.backgroundPictureBack,
          updatedData.fontSize,
          updatedData.fontFamily,
          id
      ], function(err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: "Failed to update the record" });
            }
  
            res.status(200).json({
                message: "Record updated successfully",
                updatedId: id
            });
        });
    });
  });
  
  
  //DELETE a particular template
  templateRouter.delete('/template/delete', authMisUser, (req, res) => {
    const { id } = req.query ;
    
    if (!id) {
      return res.status(400).json({ error: "ID is required" });
  }
  
  const queryToDeleteTemplate = `DELETE FROM CMS_TEMPLATE_DETAILS WHERE id = ?`;
  
  db.run(queryToDeleteTemplate, [id], function(err) {
      if (err) {
          console.error(err.message);
          return res.status(500).json({ error: "Failed to delete the record" });
      }
  
      if (this.changes === 0) {
          return res.status(404).json({ message: "Record not found" });
      }
  
      res.status(200).json({
          message: "Record deleted successfully",
          deletedId: id
      });
  });
  });
  

  module.exports = templateRouter;