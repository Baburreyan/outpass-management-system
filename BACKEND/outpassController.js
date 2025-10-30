const { createOutpass, findOutpassById, updateOutpass, getOutpassesByUser, getAllOutpasses, findUserById } = require('../database');
const { isWeekday, isValidDate, isValidDateRange } = require('../utils/dateHelper');

// Create new outpass request
exports.createOutpass = async (req, res) => {
  try {
    const { studentName, studentId, guardianName, guardianNumber, outDate, inDate, reason } = req.body;

    // Validation
    if (!studentName || !guardianName || !guardianNumber || !outDate || !inDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    // Validate dates
    if (!isValidDate(outDate) || !isValidDate(inDate)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }

    if (!isValidDateRange(outDate, inDate)) {
      return res.status(400).json({ 
        success: false, 
        message: 'In date must be after or equal to out date' 
      });
    }

    // Check if weekday
    const weekdayStatus = isWeekday(outDate);

    // Create outpass
    const outpass = createOutpass({
      studentName,
      studentId,
      guardianName,
      guardianNumber,
      outDate: new Date(outDate),
      inDate: new Date(inDate),
      reason: reason || 'Personal',
      isWeekday: weekdayStatus,
      status: 'pending',
      createdBy: req.user.id
    });

    const creator = findUserById(req.user.id);

    res.status(201).json({
      success: true,
      message: weekdayStatus 
        ? 'Request sent successfully. Awaiting mentor approval.' 
        : 'Request sent successfully to Warden.',
      data: {
        ...outpass,
        createdBy: {
          id: creator.id,
          name: creator.name,
          email: creator.email
        }
      }
    });
  } catch (error) {
    console.error('Create outpass error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating outpass request',
      error: error.message 
    });
  }
};

// Get pending requests (for mentor or warden)
exports.getPendingRequests = async (req, res) => {
  try {
    const { role } = req.user;
    let outpasses = getAllOutpasses();

    if (role === 'mentor') {
      // Mentors see only weekday pending requests
      outpasses = outpasses.filter(op => 
        op.status === 'pending' && op.isWeekday
      );
    } else if (role === 'warden') {
      // Wardens see weekend pending requests and mentor-approved requests
      outpasses = outpasses.filter(op => 
        (op.status === 'pending' && !op.isWeekday) || 
        op.status === 'mentor_approved'
      );
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Populate user data
    const populatedOutpasses = outpasses.map(outpass => {
      const creator = findUserById(outpass.createdBy);
      const mentorApprover = outpass.approvedByMentor ? findUserById(outpass.approvedByMentor.userId) : null;
      
      return {
        ...outpass,
        createdBy: creator ? {
          id: creator.id,
          name: creator.name,
          email: creator.email,
          studentName: creator.studentName,
          studentId: creator.studentId
        } : null,
        approvedByMentor: mentorApprover ? {
          userId: {
            id: mentorApprover.id,
            name: mentorApprover.name
          },
          timestamp: outpass.approvedByMentor.timestamp,
          remarks: outpass.approvedByMentor.remarks
        } : null
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: populatedOutpasses.length,
      data: populatedOutpasses
    });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching pending requests' 
    });
  }
};

// Approve outpass
exports.approveOutpass = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const { role, id: userId } = req.user;

    const outpass = findOutpassById(id);

    if (!outpass) {
      return res.status(404).json({ 
        success: false, 
        message: 'Outpass request not found' 
      });
    }

    let updatedOutpass;

    // Mentor approval
    if (role === 'mentor') {
      if (outpass.status !== 'pending' || !outpass.isWeekday) {
        return res.status(400).json({ 
          success: false, 
          message: 'This request cannot be approved by mentor' 
        });
      }

      updatedOutpass = updateOutpass(id, {
        status: 'mentor_approved',
        approvedByMentor: {
          userId,
          timestamp: new Date(),
          remarks
        }
      });
    } 
    // Warden approval
    else if (role === 'warden') {
      if (outpass.status === 'warden_approved' || outpass.status === 'rejected') {
        return res.status(400).json({ 
          success: false, 
          message: 'This request has already been processed' 
        });
      }

      if (outpass.isWeekday && outpass.status !== 'mentor_approved') {
        return res.status(400).json({ 
          success: false, 
          message: 'Weekday requests must be approved by mentor first' 
        });
      }

      updatedOutpass = updateOutpass(id, {
        status: 'warden_approved',
        approvedByWarden: {
          userId,
          timestamp: new Date(),
          remarks
        }
      });
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Populate response data
    const creator = findUserById(updatedOutpass.createdBy);
    const mentorApprover = updatedOutpass.approvedByMentor ? findUserById(updatedOutpass.approvedByMentor.userId) : null;
    const wardenApprover = updatedOutpass.approvedByWarden ? findUserById(updatedOutpass.approvedByWarden.userId) : null;

    res.status(200).json({
      success: true,
      message: 'Outpass approved successfully',
      data: {
        ...updatedOutpass,
        createdBy: creator ? {
          id: creator.id,
          name: creator.name,
          email: creator.email
        } : null,
        approvedByMentor: mentorApprover ? {
          userId: {
            id: mentorApprover.id,
            name: mentorApprover.name
          },
          timestamp: updatedOutpass.approvedByMentor.timestamp,
          remarks: updatedOutpass.approvedByMentor.remarks
        } : null,
        approvedByWarden: wardenApprover ? {
          userId: {
            id: wardenApprover.id,
            name: wardenApprover.name
          },
          timestamp: updatedOutpass.approvedByWarden.timestamp,
          remarks: updatedOutpass.approvedByWarden.remarks
        } : null
      }
    });
  } catch (error) {
    console.error('Approve outpass error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error approving outpass' 
    });
  }
};

// Reject outpass
exports.rejectOutpass = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const { role, id: userId } = req.user;

    if (role !== 'mentor' && role !== 'warden') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const outpass = findOutpassById(id);

    if (!outpass) {
      return res.status(404).json({ 
        success: false, 
        message: 'Outpass request not found' 
      });
    }

    if (outpass.status === 'warden_approved' || outpass.status === 'rejected') {
      return res.status(400).json({ 
        success: false, 
        message: 'This request has already been processed' 
      });
    }

    const updatedOutpass = updateOutpass(id, {
      status: 'rejected',
      rejectedBy: {
        userId,
        timestamp: new Date(),
        remarks: remarks || 'No remarks provided'
      }
    });

    // Populate response data
    const creator = findUserById(updatedOutpass.createdBy);
    const rejector = findUserById(updatedOutpass.rejectedBy.userId);

    res.status(200).json({
      success: true,
      message: 'Outpass rejected',
      data: {
        ...updatedOutpass,
        createdBy: creator ? {
          id: creator.id,
          name: creator.name,
          email: creator.email
        } : null,
        rejectedBy: {
          userId: {
            id: rejector.id,
            name: rejector.name
          },
          timestamp: updatedOutpass.rejectedBy.timestamp,
          remarks: updatedOutpass.rejectedBy.remarks
        }
      }
    });
  } catch (error) {
    console.error('Reject outpass error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error rejecting outpass' 
    });
  }
};

// Get outpass history
exports.getHistory = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let outpasses = [];

    if (role === 'parent') {
      // Parents see only their own requests
      outpasses = getOutpassesByUser(userId);
    } else if (role === 'mentor' || role === 'warden' || role === 'admin') {
      // Mentors, wardens, and admins see all requests
      outpasses = getAllOutpasses();
    }

    // Populate all user data
    const populatedOutpasses = outpasses.map(outpass => {
      const creator = findUserById(outpass.createdBy);
      const mentorApprover = outpass.approvedByMentor ? findUserById(outpass.approvedByMentor.userId) : null;
      const wardenApprover = outpass.approvedByWarden ? findUserById(outpass.approvedByWarden.userId) : null;
      const rejector = outpass.rejectedBy ? findUserById(outpass.rejectedBy.userId) : null;

      return {
        ...outpass,
        createdBy: creator ? {
          id: creator.id,
          name: creator.name,
          email: creator.email
        } : null,
        approvedByMentor: mentorApprover ? {
          userId: {
            id: mentorApprover.id,
            name: mentorApprover.name
          },
          timestamp: outpass.approvedByMentor.timestamp,
          remarks: outpass.approvedByMentor.remarks
        } : null,
        approvedByWarden: wardenApprover ? {
          userId: {
            id: wardenApprover.id,
            name: wardenApprover.name
          },
          timestamp: outpass.approvedByWarden.timestamp,
          remarks: outpass.approvedByWarden.remarks
        } : null,
        rejectedBy: rejector ? {
          userId: {
            id: rejector.id,
            name: rejector.name
          },
          timestamp: outpass.rejectedBy.timestamp,
          remarks: outpass.rejectedBy.remarks
        } : null
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: populatedOutpasses.length,
      data: populatedOutpasses
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching history' 
    });
  }
};

// Get statistics (for dashboard)
exports.getStatistics = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let outpasses = [];
    if (role === 'parent') {
      outpasses = getOutpassesByUser(userId);
    } else {
      outpasses = getAllOutpasses();
    }

    const stats = {
      total: outpasses.length,
      pending: outpasses.filter(op => op.status === 'pending').length,
      approved: outpasses.filter(op => op.status === 'mentor_approved' || op.status === 'warden_approved').length,
      rejected: outpasses.filter(op => op.status === 'rejected').length,
      mentor_approved: outpasses.filter(op => op.status === 'mentor_approved').length,
      warden_approved: outpasses.filter(op => op.status === 'warden_approved').length
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching statistics' 
    });
  }
};