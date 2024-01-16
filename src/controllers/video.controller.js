import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/fileHandler.js"

// not able to complete getAllVideos for now - because of lack of knowledge on pipelines but will solve this soon
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    let pipeline = [];

    if (query) {
        pipeline.push({
            $search: {
                $index: "search-video",
                $text: {
                    query: query,
                    path: ["title", "description"]
                }
            }
        });
    }

    if(userId){
        if(!isValidObjectId(userId)){
            throw new ApiError(400, "Invalid User ID")
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    pipeline.push({
        $match: {
            isPublished: true
        }
    });

    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === 'asc' ? 1 : -1
            }
        });
    } else {
        pipeline.push({
            $sort: { createdAt : -1 }
        });
    }

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const allVideos = await Video.aggregatePaginate(pipeline, options);

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

    if (!thumbnailLocalPath) {
        throw new ApiError(401, "thumbnail file is required")
    }
    
    //upload video and thumbnail to cloudinary
    const videoFile = await uploadOnCloudinary(videoFileLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!videoFile) {
        throw new ApiError(401, "video file is required")
    }
    
    if (!thumbnail) {
        throw new ApiError(401, "thumbnail file is required")
    }
    
    // create a video document 
    const video = await Video.create({
        title,
        description,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        duration: videoFile.duration,
        owner: req.user?._id,
        isPublished: true
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

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video Id")
    }

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribers"
                            },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$likes.likedBy"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                videoFile: 1,
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                isPublished: 1,
                duration: 1,
                comments: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1
            }
        }
    ]);

    if(!video){
        throw new ApiError(404, "No video found")
    }

    await Video.findByIdAndUpdate(
        videoId,
        {
                $inc: { views: 1 }
        },
        {new: true}
    )


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

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video Id")
    }

    const currentVideo = await Video.findById(videoId)

    if(currentVideo?.owner.toString() != req.user?._id){
        throw new ApiError(400, "You can't edit video content as you are not owner of this video")
    }

    if(!title && !description && !thumbnailLocalPath){
        // check if any one of this field is passed
        throw new ApiError(400, "Atleast on field should be passed to update")
    }

    // if thumbnail is to be updated condition will run
    if(thumbnailLocalPath){
        const video = await Video.findById(videoId).select("thumbnail")
        oldImageUrl = video.thumbnail.url
        
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    
        if(!thumbnail){
            throw new ApiError(401, "Error while uploading thumbnail")
        }

        await deleteFromCloudinary(video.thumbnail.public_id)
    } else {
        // or old url will be set again
        thumbnail = {
            url: oldImageUrl,
            public_id: currentVideo.thumbnail.public_id,
        };
    }

    // video is updated
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    public_id: thumbnail.public_id,
                    url: thumbnail.url
                }
            }
        },
        {new: true}
    )

    if (!updatedVideo) {
        throw new ApiError(500, "Failed to update video please try again");
    }

    return res.status(200)
    .json(new ApiResponse(200, "Video content updated successfully", updatedVideo))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const currentVideo = await Video.findById(videoId)

    if(currentVideo?.owner.toString() != req.user?._id){
        throw new ApiError(400, "You can't delete video as you are not owner of this video")
    }

    // removing all videoHistory data of deleted video
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

    // deleting video 
    const deletedVideo = await Video.findByIdAndDelete(videoId)

    if (!deletedVideo) {
        throw new ApiError(400, "Failed to delete the video please try again");
    }

    await deleteFromCloudinary(deletedVideo.videoFile.public_id)
    await deleteFromCloudinary(deletedVideo.thumbnail.public_id)

    return res.status(200)
    .json(new ApiResponse(200, "Video Deleted successfully", deletedVideo))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const currentVideo = await Video.findById(videoId)

    if(!currentVideo) {
        throw new ApiError(401, "Video not found")
    }

    if(currentVideo?.owner.toString() != req.user?._id){
        throw new ApiError(400, "You can't toggle publish status as you are not owner of this video")
    }

    const toggleVideoStatus = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !currentVideo?.isPublished
            }
        },
        {new: true}
    )
    
    return res.status(200)
    .json(new ApiResponse(200, "Video Status toggled successfully", {isPublished: toggleVideoStatus.isPublished}))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
