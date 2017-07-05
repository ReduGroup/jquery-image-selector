;(function($, window, document, undefined) {

    "use strict";

    var pluginName = "imageSelector";
    var defaults = {
        zoneTemplate: '<div class="zone"></div>',
        removeTemplate: '<span class="remove">x</span>',
        draggingClass: 'dragging',
        busyClass: 'busy',
        selected: null,
        removed: null
    };

    function ImageSelector(element, options) {
        this.element = element;

        this.settings = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    $.extend(ImageSelector.prototype, {
        $el: null,
        $container: null,
        $zone: null,
        $remove: null,
        $dummyFileInput: null,
        busy: false,
        /**
         * Plugin entry point.
         */
        init: function() {
            this.$el = $(this.element).hide();

            this.$container = $('<div class="image-selector"></div>');
            this.$zone = $(this.settings.zoneTemplate).prop('contenteditable', true);
            this.$container.append(this.$zone);

            this.$el.after(this.$container);

            this.preventKeyInput();
            this.addPasteEvent();
            this.addDropEvent();
            this.addDoubleClickEvent();
        },
        /**
         * Bind a paste event to zone to capture image data pastes.
         */
        addPasteEvent: function () {
            var _this = this;

            this.$zone.bind('paste', function (e) {
                e.preventDefault();

                var clipboardData = e.clipboardData || e.originalEvent.clipboardData || null;
                if (clipboardData) {
                    var items = clipboardData.items || null;
                    if (items) {
                        for (var i = 0, length = items.length; i < length; i++) {
                            if (items[i].kind === 'string') {
                                items[i].getAsString(function (url) {
                                    _this.loadImageFromUrl(url);
                                });
                            } else if (_this.isMimeTypeImage(items[i].type)) {
                                _this.loadImage(
                                    items[i].getAsFile()
                                );
                            }
                        }
                    }
                }

                return false;
            });
        },
        /**
         * Add bindings to the zone to handle the drag over, drag leave and drop events.
         */
        addDropEvent: function () {
            var _this = this;

            this.$zone.on('dragover', function (e) {
                e.preventDefault();
                e.stopPropagation();

                _this.$container.addClass(_this.settings.draggingClass);
            });

            this.$zone.on('dragleave', function (e) {
                e.preventDefault();
                e.stopPropagation();

                _this.$container.removeClass(_this.settings.draggingClass);
            });

            $(document).on('dragover', function (e) {
                e.preventDefault();
                return false;
            });

            this.$zone.bind('drop', function (e) {
                e.preventDefault();

                var dataTransfer = e.dataTransfer || e.originalEvent.dataTransfer || null;
                if (dataTransfer) {
                    var files = dataTransfer.files || null;
                    if (files) {
                        for (var i in files) {
                            if (_this.isMimeTypeImage(files[i].type)) {
                                _this.loadImage(
                                    files[i]
                                );

                                _this.$container.removeClass(_this.settings.draggingClass);
                                return;
                            }
                        }
                    }

                    var items = dataTransfer.items;
                    if (items) {
                        if (typeof items[0] !== 'undefined') {
                            items[0].getAsString(function (url) {
                                _this.loadImageFromUrl(url);
                            });

                            _this.$container.removeClass(_this.settings.draggingClass);
                            return;
                        }
                    }
                }

                _this.$container.removeClass(_this.settings.draggingClass);
            });
        },
        /**
         * Bind the click event to the zone to display a file selection dialog.
         */
        addDoubleClickEvent: function () {
            var _this = this;

            this.$zone.dblclick(function (e) {
                e.preventDefault();

                if (!this.$dummyFileInput) {
                    this.$dummyFileInput = $('<input type="file" accept="image/*">').css({
                        position: 'fixed',
                        left: '-1000px',
                        top: '-1000px'
                    });

                    this.$dummyFileInput.change(function (e) {
                        e.preventDefault();
                        e.stopPropagation();

                        var upload = $(this)[0];

                        if (upload.files && upload.files[0]) {
                            var file = upload.files[0];

                            if (_this.isMimeTypeImage(file.type)) {
                                _this.loadImage(
                                    file
                                );
                            }
                        }
                    });

                    this.$dummyFileInput.val('');
                    $('body').append(this.$dummyFileInput);
                }

                this.$dummyFileInput.wrap('<form>').closest('form').get(0).reset();
                this.$dummyFileInput.unwrap();
                this.$dummyFileInput.trigger('click');

                return false;
            });
        },
        /**
         * Tell if the provided mime type refers to an image i.e. it begins with 'image' (image/png, image/gif etc.)
         *
         * @param mime
         * @returns {boolean}
         */
        isMimeTypeImage: function (mime) {
            return typeof mime === 'string' && mime.indexOf('image') === 0;
        },
        /**
         * Tell if the provided value is a string URL.
         *
         * @param url
         * @returns {boolean}
         */
        isUrl: function (url) {
            if (typeof url !== 'string') {
                return false;
            }

            var pattern = new RegExp(
                '^(https?:\\/\\/)?' +
                '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' +
                '((\\d{1,3}\\.){3}\\d{1,3}))' +
                '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
                '(\\?[;&a-z\\d%_.~+=-]*)?' +
                '(\\#[-a-z\\d_]*)?$','i'
            );
            return pattern.test(url);
        },
        /**
         * Set the busy state of the plugin. Setting the busy state prevents repeated actions and updates the UI. If no
         * parameter is provided, it is assumed that we're setting the busy state to true.
         *
         * @param busy
         */
        setBusy: function (busy) {
            if (typeof busy === 'undefined') {
                busy = true;
            }

            this.busy = !! busy;
            this.$container[this.busy ? 'addClass' : 'removeClass'](this.settings.busyClass);
        },
        /**
         * Tell if the plugin is currently busy or not.
         *
         * @returns {boolean}
         */
        isBusy: function () {
            return !! this.busy;
        },
        /**
         * Load an image into the plugin. This method is responsible for creating a file reader and using it to read the
         * image data. This method is also responsible for checking and setting the busy state of the plugin.
         *
         * @param file
         * @returns {boolean}
         */
        loadImage: function (file) {
            if (this.isBusy()) {
                return false;
            }

            this.setBusy(true);

            var _this = this;
            setTimeout(function () {
                var reader = new FileReader();
                reader.onload = function (e) {
                    return _this.imageSelected(e.target.result);
                };

                reader.readAsDataURL(file);
            }, 1);
        },
        /**
         * Load an image via from URL.
         *
         * @param url
         * @returns {boolean}
         */
        loadImageFromUrl: function (url) {
            if (!this.isUrl(url)) {
                return false;
            }

            if (this.isBusy()) {
                return false;
            }

            this.setBusy(true);

            var _this = this;

            var xhr = new XMLHttpRequest();
            xhr.onload = function () {
                var reader = new FileReader();
                reader.onloadend = function () {
                    _this.imageSelected(reader.result);
                };

                reader.readAsDataURL(xhr.response);
                _this.setBusy(false);
            };

            xhr.open('GET', url);
            xhr.responseType = 'blob';
            xhr.send();
        },
        /**
         * When an image is added to the zone, this callback is executed, being provided with the image data. This
         * method is responsible for setting the data of the element this plugin represents and updating the preview and
         * state of the plugin.
         *
         * @param imageData
         */
        imageSelected: function (imageData) {
            this.setBusy(false);
            this.$el.val(imageData);
            this.updatePreview(imageData);

            var _this = this;

            if (!this.$remove) {
                this.$remove = $(this.settings.removeTemplate).click(function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    _this.updatePreview(null);
                    _this.$el.val('');

                    $(this).remove();
                    _this.$remove = null;

                    if (_this.settings.removed && typeof _this.settings.removed === 'function') {
                        _this.settings.removed();
                    }

                    return false;
                });

                this.$container.append(this.$remove);
            }

            if (typeof this.settings.selected === 'function') {
                this.settings.selected(imageData);
            }
        },
        /**
         * Update the preview by changing the background image of the zone.
         *
         * @param imageData
         */
        updatePreview: function (imageData) {
            this.$zone.css({
                'background-repeat': 'no-repeat',
                'background-position': 'center center',
                'background-size': 'cover',
                'background-image': imageData ? 'url(\''+ imageData +'\')' : 'none'
            });
        },
        /**
         * Prevent all key input except for CTRL/CMD + V.
         */
        preventKeyInput: function () {
            var events = ['keyup', 'keydown', 'keypress'];

            for (var i in events) {
                var event = events[i];

                this.$zone[event](function (e) {
                    if ((!e.ctrlKey && !e.metaKey) || e.key !== 'v') {
                        e.preventDefault();
                        return false;
                    }
                });
            }
        }
    });

    $.fn[pluginName] = function(options) {
        return this.each( function() {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new ImageSelector(this, options));
            }
        });
    };

})(jQuery, window, document);