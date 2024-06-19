const express = require('express');
const nodemailer = require('nodemailer');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const router = express.Router();
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

// Create a new student
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, enrollmentNo, emailId, password, startDate, endDate, batchId } = req.body;
    const student = new Student({
      firstName,
      lastName,
      enrollmentNo,
      emailId,
      password,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      batchId
    });

    await student.save();
    const batch = await Batch.findByIdAndUpdate(
      batchId,
      { $addToSet: { object: student._id } },
      { new: true, runValidators: true }
    );
    console.log(batch);
    console.log('EMAIL_USER:', process.env.EMAIL_USER);

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emailId,
      subject: 'Congratulations....Welcome to the batch',
      text: `Hello ${firstName},\n\nYou have been successfully enrolled in the batch with ID ${batchId}.`,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.response);
      res.status(200).json({ status: "success", message: "Student saved and email sent successfully", info: info.response });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      res.status(500).json({ status: "error", message: "Failed to send email", error: emailError.message });
    }
  } catch (error) {
    console.error("Error saving student:", error);
    if (error.code === 11000) {
      res.status(400).json({ status: "error", message: "Enrollment number already exists. Please use a different enrollment number." });
    } else {
      res.status(500).json({ status: "error", message: "Failed to save student" });
    }
  }
});

router.get('/:id/students', async (req, res) => {
  try {
    const batchId = req.params.id;
    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).send({ error: 'Batch not found' });
    }

    const studentDetails = [];
    for (const studentId of batch.object) {
      const student = await Student.findById(studentId);
      if (student) {
        studentDetails.push(student);
      }
    }

    res.status(200).send(studentDetails);
  } catch (err) {
    console.error('Error fetching students for batch:', err.message);
    res.status(500).send({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('batchId');
    if (!student) {
      return res.status(404).send('Student not found');
    }
    res.status(200).send(student);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, enrollmentNo, emailId, password, startDate, endDate, batchId } = req.body;
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).send('Student not found');
    }

    student.firstName = firstName;
    student.lastName = lastName;
    student.enrollmentNo = enrollmentNo;
    student.emailId = emailId;
    student.password = password;
    student.startDate = new Date(startDate);
    student.endDate = new Date(endDate);
    student.batchId = batchId;

    await student.save();

    if (student.batchId.toString() !== batchId.toString()) {
      await Batch.findByIdAndUpdate(
        student.batchId,
        { $pull: { object: student._id } },
        { new: true, runValidators: true }
      );
      await Batch.findByIdAndUpdate(
        batchId,
        { $addToSet: { object: student._id } },
        { new: true, runValidators: true }
      );
    }

    res.status(200).send(student);
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(400).send(err);
  }
});

router.delete('/enrollmentNo/:enrollmentNo', async (req, res) => {
  const { enrollmentNo } = req.params;
  try {
    const student = await Student.findOneAndDelete({ enrollmentNo });

    if (!student) {
      return res.status(404).send('Student not found');
    }

    await Batch.findByIdAndUpdate(
      student.batchId,
      { $pull: { object: student._id } },
      { new: true, runValidators: true }
    );

    res.status(200).send('Student deleted');
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).send(err);
  }
});

// Add or update schedule for a student
router.post('/:studentId/schedule', async (req, res) => {
  try {
    const { studentId } = req.params;
    const schedules = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send('Student not found');
    }

    schedules.forEach(schedule => {
      const { classDate, classes } = schedule;
      const parsedDate = new Date(classDate);
      
      if (isNaN(parsedDate)) {
        throw new Error("Invalid date format for classDate: ${classDate}");
      }

      const existingSchedule = student.schedule.find(
        sch => sch.classDate.toDateString() === parsedDate.toDateString()
      );

      if (existingSchedule) {
        existingSchedule.classes = classes;
      } else {
        student.schedule.push({ classDate: parsedDate, classes });
      }
    });

    await student.save();
    res.status(200).send(student);
  } catch (err) {
    console.error('Error adding/updating schedule:', err);
    res.status(500).send(err.message);
  }
});

// Delete a schedule for a student
router.delete('/:studentId/schedule/:scheduleId', async (req, res) => {
  try {
    const { studentId, scheduleId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send('Student not found');
    }

    const scheduleIndex = student.schedule.findIndex(sch => sch._id.toString() === scheduleId);
    if (scheduleIndex === -1) {
      return res.status(404).send('Schedule not found');
    }

    // Remove the schedule from student's schedule array
    student.schedule.splice(scheduleIndex, 1);
    await student.save();

    res.status(200).send('Schedule deleted successfully');
  } catch (err) {
    console.error('Error deleting schedule:', err);
    res.status(500).send(err);
  }
});

// Delete a particular class for a student on a specific day
router.delete('/:studentId/schedule/:date/:classId', async (req, res) => {
  try {
    const { studentId, date, classId } = req.params;
    const classDate = new Date(date);

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send('Student not found');
    }

    const schedule = student.schedule.find(sch => sch.classDate.toDateString() === classDate.toDateString());
    if (!schedule) {
      return res.status(404).send('Schedule not found');
    }

    const classIndex = schedule.classes.findIndex(cls => cls._id.toString() === classId);
    if (classIndex === -1) {
      return res.status(404).send('Class not found');
    }

    // Remove the class from the schedule's classes array
    schedule.classes.splice(classIndex, 1);
    await student.save();

    res.status(200).send('Class deleted successfully');
  } catch (err) {
    console.error('Error deleting class:', err);
    res.status(500).send(err);
  }
});

// Delete all schedules for a student on a particular day
router.delete('/:studentId/schedule/:date', async (req, res) => {
  try {
    const { studentId, date } = req.params;
    const classDate = new Date(date);

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send('Student not found');
    }

    // Filter out schedules that do not match the specified date
    student.schedule = student.schedule.filter(sch => !sch.classDate || sch.classDate.toDateString() !== classDate.toDateString());
    await student.save();

    res.status(200).send('Schedules for the specified date deleted successfully');
  } catch (err) {
    console.error('Error deleting schedules for date:', err);
    res.status(500).send(err);
  }
});

// Delete all schedules for a student
router.delete('/:studentId/schedule', async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send('Student not found');
    }

    // Clear the schedule array
    student.schedule = [];
    await student.save();

    res.status(200).send('All schedules deleted successfully');
  } catch (err) {
    console.error('Error deleting schedules:', err);
    res.status(500).send(err);
  }
});

router.get('/:studentId/schedule/:date', async (req, res) => {
  try {
    const { studentId, date } = req.params;
    const classDate = new Date(date);

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).send('Student not found');
    }

    const schedule = student.schedule.find(sch => sch.classDate.toDateString() === classDate.toDateString());
    if (!schedule) {
      return res.status(404).send('Schedule not found');
    }

    res.status(200).send(schedule);
  } catch (err) {
    console.error('Error fetching schedule:', err);
    res.status(500).send(err);
  }
});

router.get('/:studentId/schedules', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      console.log(`Invalid student ID: ${studentId}`);
      return res.status(400).send('Invalid student ID');
    }

    console.log(`Fetching schedules for student ID: ${studentId}`);

    const student = await Student.findById(studentId);
    if (!student) {
      console.log(`Student not found for ID: ${studentId}`);
      return res.status(404).send('Student not found');
    }

    console.log(`Student found: ${JSON.stringify(student)}`);
    res.status(200).json(student.schedule);
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;