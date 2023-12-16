import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/fileHandler.js";

const userRegister = asyncHandler( async (req, res) => {
    
    //  take input from user - validation - Not empty
    //  check if user exist - email
    //  check for images, avatar
    //  upload files to cloudinary 
    //  create user object - create entry in DB
    //  remove password and refresh token field from response
    //  check if user if created
    //  return response
    
    const { fullname, email, username, password } = req.body
    // console.log("Req.body: ", req.body);
    // console.log("email: ",email);

    if(
        [ fullname, email, username, password ].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }

    const userExists = await User.findOne({
        $or: [{ email }, { username }]
    })
    // console.log("User Exists: ", userExists);

    if (userExists) {
        throw new ApiError(409, "user with email or username already exists")
    }

    // console.log("files: ", req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(401, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    

    if (!avatar) {
        throw new ApiError(401, "Avatar file is required")
    }

    const user = await User.create({
        fullname,
        email,
        password,
        username: username.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!userCreated) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(201, userCreated, "User registered Successfully")
    )
})   

export { userRegister }