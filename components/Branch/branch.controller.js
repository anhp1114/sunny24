
const Branch = require('./branch.model');
const { setRoomCache } = require('../Room/room.controller')

const createBranch = async (req, res) => {
    try {
        let branch;
        if (req.body?.id) {
            branch = await Branch.findOneAndUpdate({
                id: req.body.id
            }, req.body, {
                new: true
            });
        } else {
            const branchCount = await Branch.countDocuments();
            req.body.id = branchCount + 1;
            branch = await Branch.create(req.body);
        }
        setRoomCache([]);
        return res.send({
            code: 1000,
            message: 'Success',
            data: branch
        })
    } catch (error) {
        console.log(`[ERROR] createBranch message: - ${error.message}`);
    }
    return res.send({
        code: 1001,
        message: 'createBranch failed'
    })
};
const getBranchs = async (req, res) => {
    try {
        const branches = await Branch.find({
            isDeleted: false
        }, '-_id -__v -updatedAt').lean();
        return res.send({
            code: 1000,
            message: 'Success',
            data: branches
        })
    } catch (error) {
        console.log(`[ERROR] getBranchs message: - ${error.message}`);
    }
    return res.send({
        code: 1001,
        message: 'getBranchs failed'
    })
};
const deleteBranch = async (req, res) => {
    try {
        await Branch.updateOne({
            id: req.body.id
        }, {
            isDeleted: true
        });
        setRoomCache([]);
        return res.send({
            code: 1000,
            message: 'Success'
        })
    } catch (error) {
        console.log(`[ERROR] deleteBranch message: - ${error.message}`);
    }
    return res.send({
        code: 1001,
        message: 'deleteBranch failed'
    })
};

module.exports = {
    createBranch,
    getBranchs,
    deleteBranch
};