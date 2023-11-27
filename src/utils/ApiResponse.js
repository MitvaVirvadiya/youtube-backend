class ApiResponse {
    constructor(
        statuscode,
        message = "Success",
        data
    ){
        this.statuscode = statuscode
        this.data = data
        this.message = message
        this.success = statuscode < 400
    }
}

export { ApiResponse }