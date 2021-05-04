import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { CallbackError, HookAsyncCallback } from 'mongoose'

import User, { IUser } from "../models/UserModel";
import loginValidator from "../validators/loginValidator";
import formatValidationMessages from "../helpers/formatValidationMessages";
import registerValidator from "../validators/registerValidator";
import mailingService from "../mailing/service";
import confirmEmailTemplate from "../mailing/confirmEmail";

const router = Router();

// Registration Route
router.post("/register", registerValidator, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatValidationMessages(errors.array()));
    }
    const { email, password, fullName } = req.body;
  
    let newUser = new User({ email, password, fullName });
    let isUserCreated = await User.findOne({ email });
    if (isUserCreated) {
      return res
        .status(409)
        .json({ message: "A user with that Email address already exists" });
    }
    newUser.password = bcrypt.hashSync(req.body.password, 10);
    newUser.save((err: CallbackError, user: IUser) => {
      if (err) {
        return res.status(400).json({
          message: err
        });
      } else {
        mailingService("Confirm Email", confirmEmailTemplate('www.google.com'), email)
        user.password = "";
        let token = jwt.sign(
          { email: user.email, fullName: user.fullName, _id: user._id },
          process.env.jwtSecret
        )
        return res.json({ token, user });
      }
    });  
  } catch (error) {
    res.status(500).json({error})
  }
  
});


// Login Route
router.post("/login", loginValidator, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationMessages(errors.array()));
  }
  let user = await User.findOne({ email: req.body.email });
  if (!user || !user.comparePassword(req.body.password)) {
    return res.status(401).json({
      message: "Authentication failed, invalid Email or Password.",
    });
  } else {
    return res.json({
      token: jwt.sign(
        { email: user.email, fullname: user.fullName, _id: user._id }
        , process.env.jwtSecret
      ),
      user: user,
      message: user.isEmailVerified
        ? `Welcome ${user.fullName}`
        : `${user.fullName}, Please verify your account `
    });
  }
});

export default router;