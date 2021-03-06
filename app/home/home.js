'use strict';

angular.module('pictifyApp.home', ['ngRoute', 'infinite-scroll'])
    .config(['$routeProvider', function ($routeProvider) {
        var routeChecks = {
            authenticated: ['$q', '$location', '$rootScope', function ($q, $location, $rootScope) {
                if (localStorage.getItem("Kinvey.kid_BkwgJlt_.activeUser")
                    || $rootScope.currentUser) {
                    return $q.when(true);
                }

                return $q.reject($location.path("/login/"));
            }]
        };

        $routeProvider.when('/', {
            templateUrl: 'home/home.html',
            controller: 'HomeCtrl',
            activetab: 'home',
            resolve: routeChecks.authenticated
        });
    }])

    .controller('HomeCtrl', ['$rootScope', '$scope', '$kinvey', 'kinveyConfig', '$location', '$route',
        function ($rootScope, $scope, $kinvey, kinveyConfig, $location, $route) {

            $scope.disableScroll = false;

            let followedUsersIds = [];

            $scope.viewProfile = function (user) {
                console.log(user);
                $location.path('/view/' + user.username);
            };

            $scope.getProfileByUsername = function (username) {
                let query = new $kinvey.Query();
                query.equalTo('username', username);

                $kinvey.User.find(query)
                    .then(function (userArr) {
                        $scope.viewProfile(userArr[0]);
                    }, function (error) {
                    })
            };

            $scope.selectPic = function (picture) {
                if (!picture) {
                }

                $scope.selectedPicture = picture;
            };

            $scope.vote = function (picture, vote) {
                let likes = picture.votes.likes;
                let dislikes = picture.votes.dislikes;
                let canVote = true;

                if (likes) {
                    for (let likeObj of likes) {
                        if (likeObj.userId === $rootScope.currentUser._id) {
                            canVote = false;
                        }
                    }
                } else {
                    likes = [];
                }

                if (dislikes) {
                    for (let dislikeObj of dislikes) {
                        if (dislikeObj.userId === $rootScope.currentUser._id) {
                            canVote = false;
                        }
                    }
                } else {
                    dislikes = [];
                }

                if (canVote) {
                    if (vote === "like") {
                        $kinvey.DataStore.update("pictures", {
                            _id: picture._id,
                            like: true
                        })
                            .then(function (response) {
                                picture.votes.likes.push(response);

                            })
                    } else if (vote === "dislike") {
                        $kinvey.DataStore.update("pictures", {
                            _id: picture._id,
                            dislike: true
                        })
                            .then(function (response) {
                                picture.votes.dislikes.push(response);
                            })
                    }
                }
            };

            $scope.comment = function (picture, commentBoxId) {
                let text = document.getElementById(commentBoxId).value;
                document.getElementById(commentBoxId).value = '';
                if (text === null || text.match(/^\s*$/) !== null) {
                    return;
                }

                let promise = $kinvey.DataStore.update("pictures", {
                    _id: picture._id,
                    content: text
                });
                promise.then(function (response) {
                    picture.comments.push(response);
                }, function (error) {
                    console.log(error);
                })
            };

            $scope.showFollowers = function (user) {
                kinveyConfig.authorize
                    .then(function () {
                        $kinvey.DataStore.get("socials", user._id)
                            .then(function (social) {
                                let followersIds = [];

                                for (let followerId in social.followers) {
                                    followersIds.push(followerId);
                                }

                                let query = new $kinvey.Query();
                                query.equalTo("_id", {"$in": followersIds}).limit(20);

                                $kinvey.User.find(query, {
                                    relations: {profilePicture: "pictures"}
                                })
                                    .then(function (users) {
                                        $scope.selectedUserFollowers = users;
                                    }, function (error) {
                                        console.log(error);
                                    })
                            }, function (error) {
                                console.log(error);
                            })
                    })
            };

            $scope.cleanFollowers = function () {
                $scope.selectedUserFollowers = [];
            };

            $scope.loadMorePosts = function () {
                kinveyConfig.authorize
                    .then(function () {
                        if (!$scope.newsFeed) {
                            return;
                        }

                        let query = new $kinvey.Query();
                        query.equalTo("_acl.creator", {"$in": followedUsersIds})
                            .lessThan("_kmd.lmt", $scope.newsFeed[$scope.newsFeed.length - 1].picture._kmd.lmt)
                            .descending("_kmd.lmt")
                            .limit(5);

                        $kinvey.DataStore.find('pictures', query)
                            .then(function (pictures) {

                                if (pictures.length === 0) {
                                    $scope.disableScroll = true;
                                    return;
                                }

                                let newsFeed = [];
                                for (let picture of pictures) {
                                    picture.date = new Date(picture._kmd.lmt);
                                    for (let user of $scope.followedUsers) {
                                        if (user._id === picture._acl.creator) {
                                            newsFeed.push({picture: picture, user: user});
                                            break;
                                        }
                                    }
                                }

                                for (let feed of newsFeed) {
                                    $scope.newsFeed.push(feed);
                                }
                            }, function (error) {
                                console.log(error);
                            })
                    });
            };

            let init = function () {
                kinveyConfig.authorize.then(function () {
                    $rootScope.currentUser = $kinvey.getActiveUser();

                    followedUsersIds.push($rootScope.currentUser._id);

                    $kinvey.DataStore.get("socials", $rootScope.currentUser._id)
                        .then(function (response) {
                            $scope.followedUsers = [];

                            for (let id in response.following) {
                                let idProxy = id;

                                followedUsersIds.push(idProxy);
                            }

                            let query = new $kinvey.Query();
                            query.equalTo("_id", {"$in": followedUsersIds});

                            $kinvey.User.find(query, {
                                relations: {profilePicture: "pictures"}
                            })
                                .then(function (followedUsers) {
                                    $scope.followedUsers = followedUsers;

                                    let queryForFeed = new $kinvey.Query();
                                    queryForFeed.equalTo('_acl.creator', {"$in": followedUsersIds})
                                        .descending("_kmd.lmt").limit(5);

                                    $kinvey.DataStore.find("pictures", queryForFeed)
                                        .then(function (pictures) {
                                            let newsFeed = [];
                                            for (let picture of pictures) {
                                                picture.date = new Date(picture._kmd.lmt);
                                                for (let user of $scope.followedUsers) {
                                                    if (user._id === picture._acl.creator) {
                                                        newsFeed.push({picture: picture, user: user});
                                                        break;
                                                    }
                                                }
                                            }

                                            $scope.newsFeed = newsFeed;
                                        }, function (error) {
                                            console.log(error);
                                        })
                                }, function (error) {
                                    console.log(error);
                                });
                        }, function (error) {
                            console.log(error);
                        });
                });
            };

            init();
        }]);