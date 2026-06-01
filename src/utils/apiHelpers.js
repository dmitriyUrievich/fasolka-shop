export const fetchAllPages = async (apiCall, params = {}) => {
    const allItems = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
        const response = await apiCall({ ...params, limit, offset });
        const items = response.data.Items || response.data.items || [];
        allItems.push(...items);
        if (items.length < limit) break;
        offset += limit;
    }

    return allItems;
};