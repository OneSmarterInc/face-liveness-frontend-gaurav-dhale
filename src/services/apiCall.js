import axiosInstance from "./axiosInstance";

export const getInstance = (url, config = {}) => {
    return axiosInstance.get(url, config);
};

export const postInstance = (url, data = {}, config = {}) => {
    return axiosInstance.post(url, data, config);
};

export const putInstance = (url, data = {}, config = {}) => {
    return axiosInstance.put(url, data, config);
};

export const deleteInstance = (url, config = {}) => {
    return axiosInstance.delete(url, config);
};
