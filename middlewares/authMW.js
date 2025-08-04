
const db = require("../config/database");
const connection = require("../config/dbmysql")


const authMisUser = async(req,res,next)=>{
   
    try{
        const sessionId = req.headers['session_id'];
    if(!sessionId){
        res.status(400).send("Invalid session");
    }

    const clientKey = (req.headers['CLIENT-KEY']);

    const queryToFetchUser = `SELECT u.name, u.email_ID, u.company, u.contact, u.USER_TYPE, u.client_id FROM MIS_USERS u JOIN 
                                MIS_USER_SESSION_DETAILS usd ON usd.MIS_USER_ID = u.id WHERE usd.SESSION_ID = ?;`;

       
        connection.query(queryToFetchUser,[sessionId],(err,result) => {
            
            result = [result];

            if (result.length > 1) {
                return res.status(400).send("Multiple records returned!") 
     
             } else if(result.length==1){
                 req.user = result[0]; 
                 req.sessionId = sessionId;   
                
                 
                 next();       
                
             }else if(!result){
                return res.status(404).send("User Not found")
             }
        })
        
   
    } catch(err){
        res.status(500).send("Something went wrong! "+err);
    }
    
}

const authPlayer = async(req,res,next)=>{
    try{
         const sessionId = req.headers['session_id'];
    if(!sessionId){
        res.status(400).send("Invalid session");
    }

    const queryToValidatePlayerSession = `SELECT * 
FROM PLAYER_SESSION_DETAILS 
WHERE SESSION_ID = ? 
  AND (EMAIL_ID IS NOT NULL OR contact IS NOT NULL);`;

connection.query(queryToValidatePlayerSession,[sessionId],(err,result)=>{
    console.log("result zero", result[0]);
    if(err){
        res.status(500).send("Error in validating player!",err);
    } else{
                console.log("player found with provided session is - email:",result[0].EMAIL_ID+", contact: "+result[0].contact);
                if(result.length==0){
                    res.status(404).send("Player with valid session not found!");
                } 

                if(result.length>0 && result[0].PLAYERID != req.query.player_id){
                    res.status(500).send("Not authorized to perform this operation for other players!")
                }else if(result.length>0 && result[0].PLAYERID == req.query.player_id){
                    req.user = result[0]; 
                 req.sessionId = sessionId;   
                 next();   
                }
                     
    }
})


    }catch(err){
        res.status(500).send("Something went wrong! "+err);
    }
}
module.exports = {authMisUser, authPlayer};