CREATE DATABASE IF NOT EXISTS demo_registration;
USE demo_registration;

CREATE TABLE IF NOT EXISTS registrations (
    id VARCHAR(8) PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    project_title VARCHAR(100) NOT NULL,
    email VARCHAR(80) NOT NULL,
    phone VARCHAR(12) NOT NULL,
    time_slot VARCHAR(50) NOT NULL
);
