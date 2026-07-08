const jwt = require('jsonwebtoken');


function authenticate(req, res, next) {
  
  // 1. Read the Authorization header: "Bearer <token>"
  const authHeader = req.headers['authorization'];

  if(!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header '});
  }

  const token = authHeader.split(' ')[1];

  try{
      // 2. Verify the JWT using jsonwebtoken.verify() and JWT_SECRET from env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Attach the decoded user info to req.user
    req.user = decoded;

    // 4. Call next() if valid, or return 401 if invalid/missing
    next();

} catch (err) {
    //Invalid or expired Token
    return res.status(401).json({ error: 'Invalid or expired token '});
  }

}

module.exports = authenticate;
