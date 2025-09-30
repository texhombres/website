const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");

hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
});

document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
    hamburger.classList.remove("active");
    navMenu.classList.remove("active");
}));

// Handle contact form submission
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.querySelector('.contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            
            // Show loading state
            submitButton.textContent = 'SENDING...';
            submitButton.disabled = true;
            
            fetch(this.action, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (response.ok) {
                    // Show success message
                    showMessage('Thank you! Your message has been sent successfully. We\'ll get back to you soon.', 'success');
                    this.reset();
                } else {
                    throw new Error('Network response was not ok');
                }
            })
            .catch(error => {
                // Show error message
                showMessage('Sorry, there was an error sending your message. Please try again.', 'error');
            })
            .finally(() => {
                // Reset button
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            });
        });
    }
    
    function showMessage(message, type) {
        // Remove any existing message
        const existingMessage = document.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        messageDiv.textContent = message;
        
        // Insert message after the form
        const form = document.querySelector('.contact-form');
        form.parentNode.insertBefore(messageDiv, form.nextSibling);
        
        // Auto-remove message after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
});

// Google Calendar Integration using iCal
const CALENDAR_ID = 'texhombres@gmail.com';

// Function to fetch upcoming events from Google Calendar using iCal
async function fetchCalendarEvents() {
    try {
        const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;
        // Try direct fetch first, fallback to proxy if CORS fails
        let response;
        try {
            response = await fetch(icalUrl);
        } catch (corsError) {
            // Fallback to CORS proxy
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(icalUrl);
            response = await fetch(proxyUrl);
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const icalData = await response.text();
        const jcalData = ICAL.parse(icalData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');
        
        if (!vevents.length) {
            return [];
        }
        
        // Expand recurring events
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        // Set end date to 6 months from now to get recurring events
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 6);
        
        const allEvents = [];
        
        vevents.forEach(vevent => {
            const event = new ICAL.Event(vevent);
            
            // Check if this is a recurring event
            if (event.isRecurring()) {
                // Expand recurring event instances
                try {
                    const expand = new ICAL.RecurExpansion({
                        component: vevent,
                        dtstart: event.startDate
                    });
                    
                    let next;
                    let count = 0;
                    // Increase limit to catch more occurrences
                    while ((next = expand.next()) && count < 50) {
                        const nextDate = next.toJSDate();
                        if (nextDate >= now && nextDate <= endDate) {
                            // Create a new event instance for this occurrence
                            const occurrence = {
                                summary: event.summary,
                                location: event.location,
                                description: event.description,
                                startDate: { toJSDate: () => nextDate, isDate: event.startDate.isDate },
                                endDate: event.endDate
                            };
                            allEvents.push(occurrence);
                        }
                        count++;
                        
                        // Safety check: if we've gone past our end date, stop
                        if (nextDate > endDate) {
                            break;
                        }
                    }
                } catch (err) {
                    console.error('Error expanding recurring event:', err);
                }
            } else {
                // Non-recurring event
                const eventDate = event.startDate.toJSDate();
                if (eventDate >= now) {
                    allEvents.push(event);
                }
            }
        });
        
        // Sort all events by date and take first 5
        const upcomingEvents = allEvents
            .sort((a, b) => a.startDate.toJSDate() - b.startDate.toJSDate())
            .slice(0, 5);
        
        return upcomingEvents;
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return [];
    }
}

// Function to format date for display (iCal version)
function formatEventDate(icalEvent) {
    const eventDate = icalEvent.startDate.toJSDate();
    
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    
    const dayName = days[eventDate.getDay()];
    const month = months[eventDate.getMonth()];
    const day = eventDate.getDate();
    
    return `${dayName} ${month}/${day}`;
}

// Function to format time for display (iCal version)
function formatEventTime(icalEvent) {
    const eventDate = icalEvent.startDate.toJSDate();
    
    // Check if it's an all-day event
    if (icalEvent.startDate.isDate) {
        return 'All Day';
    }
    
    const hours = eventDate.getHours();
    const minutes = eventDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${displayHours}:${displayMinutes}${ampm}`;
}

// Function to extract venue from event location or summary (iCal version)
function extractVenue(icalEvent) {
    // First try to get venue from location field
    if (icalEvent.location) {
        return icalEvent.location;
    }
    
    // Try to extract venue from summary if it contains venue info
    if (icalEvent.summary) {
        const summaryText = icalEvent.summary;
        
        // Handle pattern like "9pm San Jac Saloon"
        if (summaryText.includes('San Jac')) {
            return 'San Jac Saloon';
        }
        
        // Try to extract venue after time pattern (e.g., "9pm Venue Name")
        const timePattern = /^\d{1,2}(:\d{2})?\s*(am|pm)?\s+(.+)$/i;
        const match = summaryText.match(timePattern);
        if (match && match[3]) {
            return match[3].trim();
        }
        
        // If summary contains venue-like text, use it
        if (summaryText.length > 3 && !summaryText.toLowerCase().includes('show') && !summaryText.toLowerCase().includes('gig')) {
            return summaryText;
        }
    }
    
    // If no location found, use a default
    return 'San Jac Saloon';
}

// Function to get link from event description or default (iCal version)
function getEventLink(icalEvent) {
    // Check if description contains a URL
    if (icalEvent.description) {
        const desc = icalEvent.description;
        
        // First try to extract from HTML anchor tag if present
        const htmlLinkMatch = desc.match(/href=["']([^"']+)["']/);
        if (htmlLinkMatch) {
            return htmlLinkMatch[1];
        }
        
        // Otherwise look for plain URL
        const urlMatch = desc.match(/(https?:\/\/[^\s<>"']+)/);
        if (urlMatch) {
            // Clean up any trailing HTML or special characters
            return urlMatch[1].replace(/[<>]/g, '');
        }
    }
    
    // If no URL in description, return null (not '#')
    return null;
}

// Function to update the shows section with calendar events
async function updateShowsSection() {
    const showsList = document.querySelector('.shows-list');
    if (!showsList) {
        console.error('Shows list element not found');
        return;
    }
    
    // Don't show loading message - just populate when ready
    try {
        const events = await fetchCalendarEvents();
        
        if (events.length === 0) {
            showsList.innerHTML = '<div class="no-events">No upcoming shows scheduled. Check back soon!</div>';
            return;
        }
        
        // Populate with events
        showsList.innerHTML = '';
        
        events.forEach(icalEvent => {
            const showItem = document.createElement('div');
            showItem.className = 'show-item';
            
            const eventDate = formatEventDate(icalEvent);
            const eventTime = formatEventTime(icalEvent);
            const venue = extractVenue(icalEvent);
            const eventLink = getEventLink(icalEvent);
            
            // Create elements properly instead of using innerHTML
            const dateSpan = document.createElement('span');
            dateSpan.className = 'show-date';
            dateSpan.textContent = eventDate;
            
            const venueSpan = document.createElement('span');
            venueSpan.className = 'show-venue';
            venueSpan.textContent = venue;
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'show-time';
            timeSpan.textContent = eventTime;
            
            showItem.appendChild(dateSpan);
            showItem.appendChild(venueSpan);
            showItem.appendChild(timeSpan);
            
            // Only add link if there's a valid URL in the description
            if (eventLink) {
                const detailsLink = document.createElement('a');
                detailsLink.className = 'show-link';
                detailsLink.href = eventLink;
                detailsLink.target = '_blank';
                detailsLink.textContent = 'DETAILS';
                showItem.appendChild(detailsLink);
            } else {
                // Add empty span to maintain grid layout (no link)
                const emptySpan = document.createElement('span');
                emptySpan.className = 'show-link';
                showItem.appendChild(emptySpan);
            }
            
            showsList.appendChild(showItem);
        });
        
    } catch (error) {
        console.error('Error updating shows section:', error);
        showsList.innerHTML = '<div class="error">Unable to load shows. Please try again later.</div>';
    }
}

// Initialize calendar integration when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Only load calendar events if we're on a page with the shows section
    if (document.querySelector('.shows-section')) {
        updateShowsSection();
    }
});
