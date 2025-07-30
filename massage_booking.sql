-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 30, 2025 at 05:23 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `massage_booking`
--

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `therapist` varchar(255) NOT NULL,
  `time_slot` varchar(255) NOT NULL,
  `date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(50) DEFAULT 'รอดำเนินการ'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `name`, `phone`, `therapist`, `time_slot`, `date`, `created_at`, `status`) VALUES
(1, 'นาย ค', '11111111', 'หมอ 1', '11.00-12.30', '2025-07-24', '2025-07-24 03:52:55', 'ยกเลิก'),
(2, 'นาย ง', '222222222', 'หมอ 1', '13.00-14.30', '2025-07-24', '2025-07-24 03:53:40', 'สำเร็จ'),
(3, 'นาย ฆ', '33333333', 'หมอ 1', '14.30-16.00', '2025-07-24', '2025-07-24 03:54:00', 'สำเร็จ'),
(4, 'นาย จ', '44444444444', 'หมอ 1', '16.00-17.30', '2025-07-24', '2025-07-24 03:54:28', 'สำเร็จ'),
(5, 'นาย ก', '0834567891', 'หมอ 2', '16.00-17.30', '2025-07-24', '2025-07-24 07:35:08', 'ยกเลิก'),
(6, 'นาย ก', '0834567891', 'หมอ 2', '16.00-17.30', '2025-07-24', '2025-07-24 07:44:25', 'สำเร็จ'),
(7, 'นาย ฮ', '000000000', 'หมอ 13', '16.00-17.30', '2025-07-24', '2025-07-24 08:53:55', 'สำเร็จ'),
(8, 'นาย ก', '0834567891', 'หมอ 1', '11.00-12.30', '2025-07-25', '2025-07-25 01:59:06', 'สำเร็จ'),
(9, 'ลองจอง', '123456789', 'หมอ 1', '16.00-17.30', '2025-07-25', '2025-07-25 07:50:24', 'สำเร็จ'),
(10, 'ลองจอง1', '00000000000', 'หมอ 1', '14.30-16.00', '2025-07-29', '2025-07-29 06:09:08', 'อยู่ในคิว');

-- --------------------------------------------------------

--
-- Table structure for table `therapist`
--

CREATE TABLE `therapist` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `therapist`
--

INSERT INTO `therapist` (`id`, `name`) VALUES
(1, 'หมอ 1'),
(2, 'หมอ 2'),
(3, 'หมอ 3'),
(4, 'หมอ 4'),
(5, 'หมอ 5'),
(6, 'หมอ 6'),
(7, 'หมอ 7'),
(8, 'หมอ 8'),
(9, 'หมอ 9'),
(10, 'หมอ 10'),
(11, 'หมอ 11'),
(12, 'หมอ 12'),
(13, 'หมอ 13');

-- --------------------------------------------------------

--
-- Table structure for table `time_slot`
--

CREATE TABLE `time_slot` (
  `id` int(11) NOT NULL,
  `slot` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `time_slot`
--

INSERT INTO `time_slot` (`id`, `slot`) VALUES
(1, '8.00-9.30'),
(2, '9.30-11.00'),
(3, '11.00-12.30'),
(4, '13.00-14.30'),
(5, '14.30-16.00'),
(6, '16.00-17.30');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role` enum('user','admin') DEFAULT 'user',
  `Reservation` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `name`, `phone`, `role`, `Reservation`) VALUES
(5, 'test@gmail.com', '$2b$10$sSJhOlC3Prm5UT6TXPrR2uGOx3JMImK65EoY1y6J2lXos3xXC8X5O', 'นาย ก', '0834567891', 'user', 1),
(10, 'admin@gmail.com', '$2b$10$drb1QQ.slEY2NIoJw/3j1uSi36KvGuU9VMaBM2308n8aHn8Ymr1kW', 'Admin', '0800000000', 'admin', 0),
(11, 'test1@gmail.com', '$2b$10$gN/snlMGaQy7dMbifEi84O2LYffQHHBcZ3WPENvJiBlrL4B2KFmuC', 'นาย ข', '0667778889', 'user', 0),
(12, 'test2@gmail.com', '$2b$10$R0YKxX1DqwDQOnytS.Beg.0P18J4YmdxPwKQQpo1Sxp6hEPWtgMoG', 'ธนกฤต ถิ่นคำ', '063-7799214', 'user', 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `therapist`
--
ALTER TABLE `therapist`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `time_slot`
--
ALTER TABLE `time_slot`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `therapist`
--
ALTER TABLE `therapist`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `time_slot`
--
ALTER TABLE `time_slot`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
