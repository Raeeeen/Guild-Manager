# Guild-Manager — Offline Guild Official Website

Guild-Manager is the **official website for Offline Guild**, an online gaming guild focused on **MMO (Massively Multiplayer Online) games**.

The website works together with **OFFLINE-BOT**, the guild's official Discord bot, to manage guild members, announcements, attendance, and parties in one place.

## Features

### Discord Member Management

Guild-Manager displays the guild's Discord members and their information.

* View all Discord members
* Filter members by Discord role
* Search for a specific user
* Quickly find members based on their role

This makes it easier for guild administrators to manage and find members without having to manually search through Discord.

### Announcement System

Admins can create and manage guild announcements directly from the website.

When an announcement is created through Guild-Manager, **OFFLINE-BOT automatically recognizes it** and handles the announcement when its scheduled time arrives.

The website can also display announcements that were manually created through OFFLINE-BOT in Discord.

Admins can:

* Create scheduled announcements
* View announcements that have not been announced yet
* See announcements created through OFFLINE-BOT
* Manage upcoming guild announcements

All announcement data is stored in the same **MongoDB Atlas backend** used by OFFLINE-BOT.

### Attendance System

Guild-Manager includes an attendance system for tracking guild member participation.

Admins can create attendance records in a layout similar to a spreadsheet.

Features include:

* Create attendance records
* Filter attendance by Discord role
* Search for individual users
* Check a member's attendance records
* Track attendance for different guild activities

This allows guild administrators to keep track of participation without having to manage everything manually in a separate spreadsheet.

### Party Management

Guild-Manager also includes a party creation and management system for organizing MMO teams.

Admins can:

* Create multiple parties or teams
* Create as many teams as needed
* Filter available members by Discord role
* Assign members to different team roles
* Organize players based on their combat role

Each party supports the following roles:

* **DPS**
* **Tank**
* **Healer**
* **Hybrid**

This makes it easier to organize guild members into balanced teams for MMO activities.

## OFFLINE-BOT Integration

Guild-Manager and **OFFLINE-BOT** are designed to work together.

The website provides a graphical interface for managing guild information, while OFFLINE-BOT handles Discord-based interactions and automated announcements.

For example:

**Guild-Manager → Create Announcement → MongoDB Atlas → OFFLINE-BOT → Announcement Sent**

Announcements created directly through OFFLINE-BOT are also stored in the same backend and can be viewed through Guild-Manager.

Both projects use the same **MongoDB Atlas database/backend**, allowing them to share guild data.

## Technologies Used

* Web Application
* JavaScript
* MongoDB Atlas
* Discord Integration
* OFFLINE-BOT Integration
* Guild Management System

## Project Purpose

Guild-Manager was created to provide Offline Guild with a dedicated website for managing its members and activities.

Instead of relying only on Discord commands, guild administrators can use a web interface to manage members, announcements, attendance, and parties.

The project also gave me experience building a system where a website and Discord bot communicate with the same backend and share data between each other.

## Project Status

**Currently Running and In Development**

Guild-Manager is currently being used by Offline Guild.

The project is still actively being developed alongside **OFFLINE-BOT**, with ongoing improvements, fixes, and new features being added.

Both projects are currently part of the guild's active management system.
