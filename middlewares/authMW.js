
const db = require("../config/database");

const authMisUser = async(req,res,next)=>{
   
    try{
        const sessionId = req.headers['session_id'];
    if(!sessionId){
        res.status(400).send("Invalid session");
    }

    const queryToFetchUser = `SELECT u.name, u.email_ID, u.company, u.contact, u.USER_TYPE FROM MIS_USERS u JOIN 
                                MIS_USER_SESSION_DETAILS usd ON usd.MIS_USER_ID = u.id WHERE usd.SESSION_ID = ?;`;

       
        db.get(queryToFetchUser,[sessionId],(err,result) => {
            
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

module.exports = authMisUser;