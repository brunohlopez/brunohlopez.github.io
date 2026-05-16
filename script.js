$(document).ready(function () {

    // sticky navbar + scroll-up button
    $(window).scroll(function () {
        if (this.scrollY > 60) {
            $('.navbar').addClass('sticky');
        } else {
            $('.navbar').removeClass('sticky');
        }
        if (this.scrollY > 500) {
            $('.scroll-up-btn').addClass('show');
        } else {
            $('.scroll-up-btn').removeClass('show');
        }
    });

    // scroll to top
    $('.scroll-up-btn').click(function () {
        $('html').css('scrollBehavior', 'auto');
        $('html').animate({ scrollTop: 0 }, function () {
            $('html').css('scrollBehavior', 'smooth');
        });
    });

    // mobile menu toggle
    $('.hamburger').click(function () {
        $('.navbar .menu').toggleClass('open');
    });

    // close mobile menu on link click
    $('.navbar .menu li a').click(function () {
        $('.navbar .menu').removeClass('open');
    });

    // photo carousel
    var currentSlide = 0;
    var slides = $('.carousel-slide');
    var dots = $('.dot');

    function goToSlide(index) {
        slides.removeClass('active');
        dots.removeClass('active');
        slides.eq(index).addClass('active');
        dots.eq(index).addClass('active');
        currentSlide = index;
    }

    setInterval(function () {
        goToSlide((currentSlide + 1) % slides.length);
    }, 4000);

    dots.click(function () {
        goToSlide(parseInt($(this).data('index')));
    });

    // typed animation
    new Typed('.typing', {
        strings: [
            'ML Engineer',
            'Geospatial Data Scientist',
            'LLM Pipeline Builder',
            'Former Stanford Researcher',
            'Production AI Engineer',
        ],
        typeSpeed: 80,
        backSpeed: 50,
        backDelay: 1800,
        loop: true,
    });

});
