import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/fileHandler.js"

// not able to complete getAllVideos for now - because of lack of knowledge on pipelines but will solve this soon
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    let pipeline = [];

    if (query) {
        pipeline.push({
            $match: {
                owner: userId
            }
        });
    }

    if (sortBy) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === 'desc' ? -1 : 1
            }
        });
    }

    pipeline.push({
        $skip: (page - 1) * limit
    });

    pipeline.push({
        $limit: limit
    });

    const allVideos = await Video.aggregate(pipeline);

    res.status(200).json(new ApiResponse(200, "All videos fetched", allVideos));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body

    //check wether all fields are passed
    if ([title, description].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required")
    }

    const videoFileLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    if (!videoFileLocalPath) {
        throw new ApiError(401, "video file is required")
    }
    
    //upload video and thumbnail to cloudinary
    const videoFile = await uploadOnCloudinary(videoFileLocalPath)
    console.log(videoFile);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    console.log(thumbnail);
    
    if (!videoFile) {
        throw new ApiError(401, "video file is required")
    }
    
    // create a video document 
    const video = await Video.create({
        title,
        description,
        videoFile: videoFile.url,
        thumbnail: thumbnail?.url || "",
        duration: videoFile.duration,
        owner: req.user?._id
    })
    
    const createdVideo = await Video.findById(video._id)
    
    if(!createdVideo){
        throw new ApiError(401, "Something wrong while Adding a video")
    }

    return res
    .status(200)
    .json( new ApiResponse(200, "Video Published Successfully", createdVideo) )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    // video is fetched 
    // view needs to be updated as i think this route will be hit when user want to view video and add this videoID in user watchHistory
    const video = await Video.findByIdAndUpdate(
        videoId,
        {
                $inc: { views: 1 }
        },
        {new: true}
    )

    if(!video){
        throw new ApiError(404, "No video found")
    }

    const user = await User.findById(req.user?._id).select('watchHistory')

    user.watchHistory.push(videoId)
    await user.save()

    const updatedVideo = {
        video,
        watchHistory: user.watchHistory
    }

    return res
    .status(200)
    .json(new ApiResponse(200, "Video Fetched successfully", updatedVideo))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    const {title, description} = req.body

    const thumbnailLocalPath = req.file?.path
    let thumbnail
    let oldImageUrl

    if(!title && !description && !thumbnailLocalPath){
        // check if any one of this field is passed
        throw new ApiError(401, "Atleast on field should be passed to update")
    }

    // if thumbnail is to be updated condition will run
    if(thumbnailLocalPath){
        const video = await Video.findById(videoId).select("thumbnail")
        oldImageUrl = video.thumbnail
        
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath, oldImageUrl)
    
        if(!thumbnail){
            throw new ApiError(401, "Error while uploading thumbnail")
        }
    } else {
        // or old url will be set again
        thumbnail = { url: oldImageUrl }
    }

    // video is updated
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: thumbnail.url
            }
        },
        {new: true}
    )

    return res.status(200)
    .json(new ApiResponse(200, "Video content updated successfully", updatedVideo))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    const result = await User.updateMany(
        { 
            watchHistory: {
                $in: [videoId]
            } 
        }, 
        {
            $pull: {
                watchHistory: videoId
            }
        }
    )

    const deletedVideo = await Video.findByIdAndDelete(videoId)

    return res.status(200)
    .json(new ApiResponse(200, "Video Deleted successfully", deletedVideo))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    // video fetched
    const currentVideo = await Video.findById(videoId)

    if(!currentVideo) {
        throw new ApiError(401, "Video not found")
    }

    // logic for toggle ispublished
    currentVideo.isPublished = !currentVideo.isPublished
    const updatedVideo = await currentVideo.save()

    return res.status(200)
    .json(new ApiResponse(200, "Video Status toggled successfully", updatedVideo))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
